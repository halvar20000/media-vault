# Changelog

All notable changes to media-vault are recorded here. The same history is
viewable inside the app — click the version badge in the header.

The format follows [Keep a Changelog](https://keepachangelog.com/), and versions
follow [Semantic Versioning](https://semver.org/).

## [1.14.0] — 2026-09-17

### Added
- **Choose cover… (artwork picker)** — every matched item now has a picker that lists
  the alternate images its metadata source knows, so you can pick the one that matches
  the disc on your shelf: **TMDB** posters in your configured language first, then
  English and textless (plus that season's posters for a series box with a season
  number); **IGDB** cover, **regional box art** (e.g. the Japanese sleeve) and promo
  artworks; **Discogs** scans of the release *and* of the master's other pressings;
  **Cover Art Archive** fronts of every MusicBrainz release in the group. The pick is
  cached locally like any other cover. Find it next to "Fix match…" in the item drawer.
- **MusicBrainz as a keyless music source** — vinyl / singles / CDs no longer require
  Discogs credentials. When none are configured, media-vault searches **MusicBrainz**
  (release groups, with community ratings) and pulls covers from the **Cover Art
  Archive**, including **barcode lookup** for the scanner. Discogs is still preferred
  when its key is present (liner notes, marketplace valuation). Polite by design:
  requests are serialized at 1/s with a proper User-Agent and back off on 503.

## [1.13.0] — 2026-09-17

### Added
- **Barcode scanning without HTTPS** — the scanner now has a **"Take a photo of the
  barcode"** button that opens the phone's camera app and decodes the barcode from
  the still image. Live camera scanning requires a secure context (HTTPS or
  localhost), so on a plain `http://server:port` LAN address from a phone it could
  never start; media-vault now detects that up front, explains it, and offers the
  photo route instead. Clearer messages when camera permission is denied or no
  barcode is found in the photo.

## [1.12.0] — 2026-08-17

### Added
- **Per-season covers for series box sets** — a series item can now carry a **season
  number**, and each season box gets its **own** cover: media-vault fetches that
  season's poster from TMDB (`/tv/{id}/season/{n}`) instead of the shared series
  poster. Set it via the new **`season`** column in the universal CSV (one row per
  season box), or per item in its details. The season shows as a cover badge and a
  "Season N" label; the title stays the plain series name.

## [1.11.0] — 2026-08-17

### Added
- **Re-fetch field picker** — "↻ Re-fetch all" now opens a dialog to choose what to
  overwrite: **Title**, **Cover**, and/or **Text** (rating + description). Handy to
  pull just the localized title after a language switch, without disturbing covers.
- Enrichment can now **update the title** from the source (it never touched titles
  before). Applied only when **Title** is ticked, and only where a correct ID/match
  exists — so it won't overwrite a title it can't confirm.

## [1.10.0] — 2026-08-17

### Added
- **"↻ Re-fetch all" button** — re-pulls covers, ratings and descriptions for every
  item from scratch. Useful after switching the **TMDB language** (e.g. English →
  German) or to refresh stale metadata. Unlike the normal *Enrich* (new items only,
  cache-first), Re-fetch **bypasses the shared cache** and fetches fresh, so a
  language change actually takes effect. Set the language under **Settings → TMDB
  language** (e.g. `de-DE`) first. Movies & series are localized by TMDB; games
  (IGDB) and music (Discogs) are not language-specific.

## [1.9.0] — 2026-08-17

### Added
- **TV series as a first-class category** — a new `series` media type with its own
  filter chip alongside Films. Series enrich from TMDB via the **`/tv`** endpoints
  (both title search and exact-id lookup), so box sets get the right artwork, rating
  and description.
- In the **universal CSV**, set `type` to `series` and put the show's **TMDB TV id**
  in `tmdb_id`. Movies and series live in separate id spaces on TMDB, so a series id
  is resolved against `/tv/{id}` — no more silently matching an unrelated film that
  happens to share the number.

## [1.8.0] — 2026-08-17

### Added
- **Universal CSV import** — a single documented, AI-fillable format for every media
  type: a header row with columns `type,title,year,format,tmdb_id,notes` (one row per
  item). Available under **Add → Import → Universal CSV**, with a downloadable template.
  Add a `tmdb_id` (or `igdb_id` / `discogs_id`) to a row and enrichment fetches that
  **exact** record — ideal for having an AI identify discs from photos and fill the CSV.
  Rows without an id still match by title. Handles comma or semicolon (Excel) delimiters.

## [1.7.1] — 2026-08-17

### Changed
- The console picker now lets you **add duplicates** — click a console again to add
  another (e.g. two PS3s, several Xbox 360s). A ×N badge shows how many you own. For a
  limited/special edition, add the base console then rename it and set your own photo
  in its details.

## [1.7.0] — 2026-08-16

### Added
- **Gaming consoles category** — a new "Consoles" media type. **Add → Console** shows
  a picker of 33 consoles (Nintendo, PlayStation, Xbox, Sega, Game Boy, Steam Deck…),
  each with a real photo; click the ones you own to add them. Consoles get their own filter.

## [1.6.0] — 2026-08-16

### Added
- **Listen on Spotify / Apple Music** — CDs, singles and vinyl get ▶ Spotify and
  ▶ Apple Music buttons that open the album ready to play. No account or API key needed.

## [1.5.1] — 2026-08-16

### Changed
- Imported **Steam** games now show a distinct "STEAM" spine badge (was generic "PC").
  Filter to just your Steam library via **Games → platform dropdown**.

## [1.5.0] — 2026-08-16

### Added
- **Steam library import** — **Add → Steam** imports your owned Steam games (with
  cover art) as digital "Steam" items, alongside your physical shelf. Needs a free
  Steam Web API key (⚙ Settings) and a public Steam profile; re-run any time to add
  new purchases (already-imported games are skipped).

## [1.4.0] — 2026-08-16

### Added
- **Console compatibility banners** in the catalogue for hardware-level backward
  compatibility: Wii → Wii U, Switch → Switch 2, PS1 → PS2/PS3, PS4 → PS5, DS → 3DS,
  GBA → DS, with model caveats where relevant (PS2 → PS3 only on early "fat" models,
  GameCube → Wii only on early models). PS3 → PS4/PS5 is intentionally not shown
  (unsupported); Xbox 360 remains per-game (see 1.3.0).

## [1.3.0] — 2026-08-16

### Added
- **Xbox 360 backward-compatibility tags** — in the Xbox 360 catalogue, games playable
  on Xbox One and Series X|S show a "✓ Xbox One/Series" tag, based on Microsoft's
  official back-compat list (615 titles). Useful when buying 360 games for a newer console.

## [1.2.0] — 2026-08-13

### Added
- **Bigger games catalogue** — now 34 consoles, including Xbox Series X|S, Switch 2,
  PS Vita, the Sega range (Dreamcast, Saturn, Mega Drive/Genesis, Master System,
  Game Gear), Game Boy / Game Boy Color, Neo Geo, TurboGrafx-16, Atari 2600 and more.
- **Cross-platform ownership** in the catalogue — a game you own on another console
  shows a "✓ <platform>" badge (e.g. browsing PS3, a title you have on Xbox 360 is
  flagged), and you can still wishlist it for the platform you're viewing.

## [1.1.0] — 2026-08-13

### Added
- **French and Spanish** interfaces — the app now speaks English, German, French
  and Spanish. Language is auto-detected from the browser and switchable from the
  header menu.

## [1.0.0] — 2026-08-13

First release.

### Added
- **Automatic artwork** — covers, ratings & descriptions per media type (IGDB for
  games, TMDB for movies, Discogs for vinyl/CD).
- **Spine-shelf** view plus a gallery grid.
- **Adding items** — title search, barcode (phone camera or USB scanner), manual
  entry, and CSV import; plus CSV export.
- **Wishlist**, **bundle checker** (paste a list → owned / new / wishlist), and a
  **games catalogue** that overlays what you own.
- **Valuation** — Discogs marketplace for music, free eBay used-listing prices for
  games (or PriceCharting).
- **In-app Settings** — configure shops/marketplaces and API keys in the app, with
  no env editing or restart.
- **Shop shortcuts** — leboncoin, eBay, Kleinanzeigen, medimops, Easy Cash (with a
  store filter), GameStop, Craigslist, or your own custom shop.
- **English & German** interface.

[1.14.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.14.0
[1.13.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.13.0
[1.12.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.12.0
[1.11.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.11.0
[1.10.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.10.0
[1.9.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.9.0
[1.8.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.8.0
[1.7.1]: https://github.com/halvar20000/media-vault/releases/tag/v1.7.1
[1.7.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.7.0
[1.6.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.6.0
[1.5.1]: https://github.com/halvar20000/media-vault/releases/tag/v1.5.1
[1.5.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.5.0
[1.4.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.4.0
[1.3.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.3.0
[1.2.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.2.0
[1.1.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.1.0
[1.0.0]: https://github.com/halvar20000/media-vault/releases/tag/v1.0.0
