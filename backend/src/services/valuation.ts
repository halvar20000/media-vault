// Valuation router — condition-aware market value per item.
//   games → PriceCharting (paid token), music → Discogs marketplace, movies → none.
// Manual values are never overwritten by a bulk run.
import { config, MediaType } from '../config';
import { query } from '../db/pool';
import type { Item, ValueResult } from '../types';
import { priceChartingValue } from './pricecharting';
import { discogsMarketValue } from './discogs';
import { ebayValue } from './ebay';

export type ValueSource = 'pricecharting' | 'discogs' | 'ebay';

export function valueSourceFor(type: MediaType): ValueSource | null {
  // Games: prefer free eBay when configured, else the paid PriceCharting.
  if (type === 'game') return config.ebay.enabled ? 'ebay' : 'pricecharting';
  if (type === 'lp' || type === 'single' || type === 'cd') return 'discogs';
  return null; // movies have no automatic price source
}

export function valueSourceEnabled(src: ValueSource): boolean {
  if (src === 'ebay') return config.ebay.enabled;
  if (src === 'pricecharting') return config.pricecharting.enabled;
  return config.discogs.enabled;
}

export interface ValueOutcome {
  status: 'valued' | 'no-match' | 'no-source' | 'source-disabled' | 'skipped-manual' | 'error';
  message?: string;
}

export async function valueItem(item: Item, opts: { allowManualOverride?: boolean } = {}): Promise<ValueOutcome> {
  if (item.value_manual && !opts.allowManualOverride) return { status: 'skipped-manual' };

  const src = valueSourceFor(item.type);
  if (!src) return { status: 'no-source' };
  if (!valueSourceEnabled(src)) return { status: 'source-disabled' };

  try {
    let result: ValueResult | null = null;
    if (src === 'ebay') {
      result = await ebayValue(item.title, item.format);
    } else if (src === 'pricecharting') {
      result = await priceChartingValue(item.title, item.format, item.condition);
    } else {
      // Discogs needs the release id captured during enrichment.
      if (item.source === 'discogs' && item.source_id) {
        result = await discogsMarketValue(item.source_id);
      } else {
        return { status: 'no-match', message: 'enrich the item first to get its Discogs release id' };
      }
    }
    if (!result) return { status: 'no-match' };

    await query(
      `UPDATE items SET value = $2, value_currency = $3, value_source = $4,
         value_manual = false, valued_at = now()
       WHERE id = $1`,
      [item.id, result.value, result.currency, `${result.source}${result.note ? ` (${result.note})` : ''}`]
    );
    return { status: 'valued' };
  } catch (err: any) {
    console.error(`[value] item ${item.id} (${item.title}) failed:`, err?.message ?? err);
    return { status: 'error', message: err?.message ?? String(err) };
  }
}

export interface ValueSummary {
  total: number;
  valued: number;
  noMatch: number;
  noSource: number;
  disabled: number;
  skipped: number;
  errors: number;
}

export async function valueUserItems(userId: string): Promise<ValueSummary> {
  const items = await query<Item>(
    `SELECT * FROM items WHERE user_id = $1 AND value_manual = false ORDER BY created_at ASC`,
    [userId]
  );
  const s: ValueSummary = { total: items.length, valued: 0, noMatch: 0, noSource: 0, disabled: 0, skipped: 0, errors: 0 };
  for (const item of items) {
    const src = valueSourceFor(item.type);
    if (!src) { s.noSource++; continue; }
    if (!valueSourceEnabled(src)) { s.disabled++; continue; }

    const outcome = await valueItem(item);
    switch (outcome.status) {
      case 'valued': s.valued++; await sleep(src === 'discogs' ? 1100 : 300); break;
      case 'no-match': s.noMatch++; break;
      case 'skipped-manual': s.skipped++; break;
      case 'error': s.errors++; break;
      default: break;
    }
  }
  return s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
