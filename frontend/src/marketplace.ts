import type { Item, MediaType } from './types';

// The deployer picks which second-hand marketplace the "find deals / bundles"
// links point at (MARKETPLACE env var). Each preset knows how to build a search
// URL (cheapest-first where the site supports it) and phrases "bundle/lot"
// searches in the marketplace's own language. We only ever link out to the
// site's own search — no scraping — which is reliable and within their terms.

type Lang = 'fr' | 'de' | 'en' | 'nl' | 'es';

export interface Marketplace {
  id: string;
  label: string;
  lang: Lang;
  build: (query: string) => string;
  // Shops (fixed catalogue, no classifieds "lots") override the bundle chip to
  // link at a stable category page instead of a lot search.
  bundle?: (type: MediaType | 'all', format?: string) => string;
}

const enc = (s: string) => encodeURIComponent(s.trim());

// eBay "_sop=15" = sort by price + shipping, lowest first.
const ebay = (host: string) => (q: string) =>
  `https://www.${host}/sch/i.html?_nkw=${enc(q)}&_sop=15`;

// Optional Easy Cash store filter (exact facet value, e.g. "68 - Mulhouse").
// Set once from /api/auth/config; blank = the full online catalogue.
let easycashStore = '';
export function setEasycashStore(v: string | undefined): void {
  easycashStore = (v || '').trim();
}

// Easy Cash catalogue search (hosted on the bons-plans subdomain), optionally
// pinned to a single physical store via the relatedShops facet.
const easycashUrl = (q: string) => {
  const base = `https://bons-plans.easycash.fr/catalog/search?searchText=${enc(q)}&q=${enc(q)}`;
  return easycashStore ? `${base}&facets%5BrelatedShops%5D%5B%5D=${enc(easycashStore)}` : base;
};

// Human label for the configured store, e.g. "68 - Mulhouse" -> "Mulhouse".
export function easycashStoreLabel(): string {
  return easycashStore.replace(/^\s*\d+\s*-\s*/, '').trim();
}

// Browse everything of a media type in stock at the configured store, cheapest first.
export function easycashStoreBrowseUrl(type: MediaType | 'all' = 'game'): string {
  const term =
    type === 'movie' ? 'dvd blu-ray'
    : type === 'lp' || type === 'single' ? 'vinyle'
    : type === 'cd' ? 'cd'
    : 'jeux video';
  return `${easycashUrl(term)}&sort=asc`;
}

const MARKETPLACES: Record<string, Marketplace> = {
  leboncoin: {
    id: 'leboncoin',
    label: 'leboncoin',
    lang: 'fr',
    build: (q) => `https://www.leboncoin.fr/recherche?text=${enc(q)}&sort=price&order=asc`,
  },
  kleinanzeigen: {
    id: 'kleinanzeigen',
    label: 'Kleinanzeigen',
    lang: 'de',
    build: (q) => `https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${enc(q)}`,
  },
  'ebay-de': { id: 'ebay-de', label: 'eBay.de', lang: 'de', build: ebay('ebay.de') },
  'ebay-com': { id: 'ebay-com', label: 'eBay.com', lang: 'en', build: ebay('ebay.com') },
  'ebay-uk': { id: 'ebay-uk', label: 'eBay.co.uk', lang: 'en', build: ebay('ebay.co.uk') },
  'ebay-fr': { id: 'ebay-fr', label: 'eBay.fr', lang: 'fr', build: ebay('ebay.fr') },
  marktplaats: {
    id: 'marktplaats',
    label: 'Marktplaats',
    lang: 'nl',
    build: (q) => `https://www.marktplaats.nl/q/${enc(q)}/`,
  },
  wallapop: {
    id: 'wallapop',
    label: 'Wallapop',
    lang: 'es',
    build: (q) => `https://es.wallapop.com/app/search?keywords=${enc(q)}`,
  },
  // Easy Cash — French used-goods SHOP chain (easycash.fr; catalogue on the
  // bons-plans subdomain). Per-item search hits its catalogue search; the
  // "bundles" chip searches the plain type term (a shop sells singles, not lots).
  easycash: {
    id: 'easycash',
    label: 'Easy Cash',
    lang: 'fr',
    build: easycashUrl,
    bundle: (type) =>
      easycashUrl(
        type === 'game' ? 'jeux video'
        : type === 'movie' ? 'dvd blu-ray'
        : type === 'lp' || type === 'single' ? 'vinyle'
        : type === 'cd' ? 'cd'
        : 'jeux video'
      ),
  },
  // medimops (momox) — German used-media SHOP, not a classifieds site. Per-item
  // search uses its own search endpoint; the "bundles" chip links at the stable
  // category page (medimops has no lots, and only sells used stock anyway).
  medimops: {
    id: 'medimops',
    label: 'medimops',
    lang: 'de',
    build: (q) => `https://www.medimops.de/?listtype=search&searchparam=${enc(q)}`,
    bundle: (type) => {
      const cat =
        type === 'game' ? 'spiele-C0300992'
        : type === 'movie' ? 'filme-C0284266'
        : type === 'lp' || type === 'single' || type === 'cd' ? 'musik-C0255882'
        : 'produkte-C0';
      return `https://www.medimops.de/${cat}/`;
    },
  },
};

const DEFAULT_ID = 'leboncoin';

export function getMarketplace(id: string | undefined): Marketplace | null {
  if (!id || id === 'none') return null;
  return MARKETPLACES[id] ?? MARKETPLACES[DEFAULT_ID];
}

// Resolve a list of ids to distinct marketplaces (skips "none"/unknown dupes).
export function getMarketplaces(ids: string[] | undefined): Marketplace[] {
  const out: Marketplace[] = [];
  const seen = new Set<string>();
  for (const id of ids ?? []) {
    if (id === 'none') continue;
    const m = MARKETPLACES[id];
    if (m && !seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

// Bundle ("lot"/"Konvolut") search phrasing per marketplace language.
function bundleQuery(lang: Lang, type: MediaType | 'all', format?: string): string {
  const f = format?.trim();
  switch (lang) {
    case 'fr':
      if (type === 'game') return f ? `lot jeux ${f}` : 'lot jeux vidéo';
      if (type === 'movie') return f ? `lot ${f}` : 'lot dvd blu-ray';
      if (type === 'lp') return 'lot vinyles';
      if (type === 'single') return 'lot vinyles 45 tours';
      if (type === 'cd') return 'lot cd';
      return 'lot jeux vidéo';
    case 'de':
      if (type === 'game') return f ? `konvolut spiele ${f}` : 'konvolut videospiele';
      if (type === 'movie') return f ? `sammlung ${f}` : 'sammlung dvd blu-ray';
      if (type === 'lp') return 'schallplatten sammlung';
      if (type === 'single') return 'single schallplatten sammlung';
      if (type === 'cd') return 'cd sammlung';
      return 'konvolut videospiele';
    case 'nl':
      if (type === 'game') return f ? `${f} games partij` : 'games partij lot';
      if (type === 'movie') return f ? `${f} partij` : 'dvd blu-ray partij';
      if (type === 'lp') return 'vinyl platen partij';
      if (type === 'single') return 'singles vinyl partij';
      if (type === 'cd') return 'cd partij';
      return 'games partij lot';
    case 'es':
      if (type === 'game') return f ? `lote juegos ${f}` : 'lote videojuegos';
      if (type === 'movie') return f ? `lote ${f}` : 'lote dvd blu-ray';
      if (type === 'lp') return 'lote vinilos';
      if (type === 'single') return 'lote singles vinilo';
      if (type === 'cd') return 'lote cd';
      return 'lote videojuegos';
    case 'en':
    default:
      if (type === 'game') return f ? `${f} games bundle lot` : 'video games bundle lot';
      if (type === 'movie') return f ? `${f} bundle lot` : 'dvd blu-ray bundle lot';
      if (type === 'lp') return 'vinyl records bundle lot';
      if (type === 'single') return '7 inch vinyl records lot';
      if (type === 'cd') return 'cd bundle lot';
      return 'video games bundle lot';
  }
}

// Search the marketplace for a single item, cheapest-first where supported.
export function marketplaceItemUrl(
  mkt: Marketplace,
  item: Pick<Item, 'title' | 'format' | 'type'>
): string {
  // Drop the "(360)" style disambiguator from the display title.
  const cleanTitle = item.title.replace(/\s*\([a-z0-9][a-z0-9 \-]{0,6}\)\s*$/i, '').trim();
  const parts = [cleanTitle];
  if ((item.type === 'game' || item.type === 'movie') && item.format) parts.push(item.format);
  return mkt.build(parts.join(' ').trim());
}

// Search the marketplace for bundles/lots of a media type (+ optional format).
export function marketplaceBundleUrl(
  mkt: Marketplace,
  type: MediaType | 'all',
  format?: string
): string {
  if (mkt.bundle) return mkt.bundle(type, format);
  return mkt.build(bundleQuery(mkt.lang, type, format));
}
