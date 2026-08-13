// In-app version history. Bundled with the build, so it always matches the
// version the user is running (no external fetch). Newest first. When cutting a
// release, add an entry here AND in the root CHANGELOG.md, then bump package.json.
export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  title?: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.1.0',
    date: '2026-08-13',
    title: 'French & Spanish',
    changes: [
      'Added French and Spanish interfaces — the app now speaks English, German, French & Spanish.',
      'Your language is auto-detected from the browser, and you can switch any time from the language menu in the header.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-13',
    title: 'First release',
    changes: [
      'Automatic artwork — covers, ratings & descriptions per media type (IGDB for games, TMDB for movies, Discogs for vinyl/CD).',
      'Signature spine-shelf view plus a gallery grid.',
      'Add items by title search, barcode (phone camera or USB scanner), manual entry, or CSV import — and CSV export.',
      'Wishlist, bundle checker (paste a list → owned / new / wishlist), and a games catalogue that marks what you own.',
      'Valuation: Discogs marketplace for music, free eBay used-listing prices for games (or PriceCharting).',
      'In-app ⚙ Settings — configure shops/marketplaces and API keys right in the app, no env editing or restart.',
      'Second-hand shop shortcuts: leboncoin, eBay, Kleinanzeigen, medimops, Easy Cash (with store filter), GameStop, Craigslist, or your own custom shop.',
      'English & German interface.',
    ],
  },
];
