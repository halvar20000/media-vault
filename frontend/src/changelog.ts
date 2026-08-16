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
    version: '1.6.0',
    date: '2026-08-16',
    title: 'Listen on Spotify / Apple Music',
    changes: [
      'CDs, singles and vinyl now have ▶ Spotify and ▶ Apple Music buttons that open the album ready to play. No account or API key needed.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-08-16',
    title: 'Steam games stand out',
    changes: [
      'Imported Steam games now show a distinct "STEAM" spine badge (instead of generic "PC"). Filter to just your Steam library via the Games → platform dropdown.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-16',
    title: 'Import your Steam library',
    changes: [
      'Add → Steam imports your owned Steam games (with cover art) as digital "Steam" items — great alongside your physical shelf.',
      'Needs a free Steam Web API key (⚙ Settings) and a public Steam profile. Re-run any time to pull in new purchases; already-imported games are skipped.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-16',
    title: 'More console compatibility hints',
    changes: [
      'The catalogue now shows a compatibility banner for hardware-level backward compatibility: Wii → Wii U, Switch → Switch 2, PS1 → PS2/PS3, PS4 → PS5, DS → 3DS, GBA → DS, with model caveats where they matter (e.g. PS2 → PS3 only on early "fat" models).',
      'Kept honest: PS3 games are not shown as compatible with PS4/PS5 (they aren\'t), and Xbox 360 stays per-game since only some titles are supported.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-16',
    title: 'Xbox 360 backward-compatibility tags',
    changes: [
      'In the Xbox 360 catalogue, games that are backward-compatible on Xbox One and Series X|S now show a "✓ Xbox One/Series" tag — handy when buying 360 games to play on a newer console.',
      'Based on Microsoft\'s official backward-compatibility list (615 titles).',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-13',
    title: 'Bigger catalogue + cross-platform ownership',
    changes: [
      'The games catalogue now covers 34 consoles — added Xbox Series X|S, Switch 2, PS Vita, plus Sega (Dreamcast, Saturn, Mega Drive/Genesis, Master System, Game Gear), Game Boy / Game Boy Color, Neo Geo, TurboGrafx-16, Atari 2600, Commodore 64 and more.',
      'Cross-platform ownership: a game you own on another console now shows a "✓ <platform>" badge in the catalogue (e.g. browsing PS3, a game you have on Xbox 360 is flagged) — and you can still wishlist it for the platform you\'re viewing.',
    ],
  },
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
