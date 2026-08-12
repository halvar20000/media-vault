# media-vault

> **Working name — placeholder.** A self-hosted, open-source catalog for **physical
> media collections**: video games, movies, vinyl LPs & singles, CDs. Your data lives
> on *your* server. Think "Jellyfin for physical-media collectors."

Each item automatically gets a **cover image, a rating, and a description**, fetched from
the right database per media type (IGDB for games, TMDB for films, Discogs for vinyl/CD)
and unified into one browsable **spine shelf**.

![status](https://img.shields.io/badge/status-early--v1-E0A126) ![license](https://img.shields.io/badge/license-AGPL--3.0-4C9A5A)

---

## Why self-hosted

People who collect *physical* media do so precisely because they distrust digital-only,
cloud-locked ownership. So this app is one you run on your **own** server, with your
**own** data and your **own** free API keys. No global accounts, no SaaS lock-in.

## Features (v1)

- **Unified catalog** across games / movies / vinyl LPs / singles / CDs — one item model.
- **Automatic artwork** — cover image + rating + description auto-fetched per media type.
- **Signature spine-shelf** view (colour = platform/format) plus a gallery grid.
- **Add flows**: title search with auto-fill, CSV bulk import, best-effort in-browser
  barcode scan.
- **Server-side metadata cache** — each title fetched once, respecting API terms.
- **Valuation** — per-item market value + a collection total, condition-aware. Music via
  Discogs marketplace (free), games via **eBay used-listing prices (free API key)** — or
  PriceCharting if you have a paid token — and manual values for anything else.
- **Multi-user within one instance** (e.g. a household) via local email + password.

## Metadata sources (bring your own free keys)

| Media | Source | Get a key |
|-------|--------|-----------|
| Games | [IGDB](https://api-docs.igdb.com/) (via Twitch app) | https://dev.twitch.tv/console/apps |
| Movies | [TMDB](https://developer.themoviedb.org/) | https://www.themoviedb.org/settings/api |
| Vinyl / Singles / CD | [Discogs](https://www.discogs.com/developers) | https://www.discogs.com/settings/developers |

Enrichment stays idle for any source whose keys are blank — the app still runs.

---

## Quick start (Docker)

```bash
cp .env.example .env      # then fill in your keys + a SESSION_SECRET
docker compose up -d      # pulls the prebuilt image (no build step)
```

Open **http://localhost:8080**, log in as the seed user (`admin@media-vault.local` /
`SEED_USER_PASSWORD`), then click **Enrich collection** to fetch covers/ratings/descriptions.
The app is a single image (API + UI on one port) plus a Postgres container.

**Updating** is just a pull — no rebuild:

```bash
docker compose pull && docker compose up -d
```

Images are published automatically to `ghcr.io/halvar20000/media-vault` on every commit.

### Unraid

Install a `postgres:16-alpine` container first and point the DB variables at it, then either:

- **Community Applications** — search for *media-vault* in the Apps tab (once listed), or
- **Docker → Add Container → Template** with:
  `https://raw.githubusercontent.com/halvar20000/media-vault/main/templates/media-vault.xml`, or
- the **Docker Compose Manager** plugin with the `docker-compose.yml` above.

The CA store listing is defined by [`ca_profile.xml`](ca_profile.xml) + [`templates/media-vault.xml`](templates/media-vault.xml).

## Local development (no Docker)

Requires Node 20+ and a local Postgres.

```bash
# 1. Postgres — create a db matching your .env, then:
cd backend && npm install && npm run migrate && npm run seed && npm run dev   # API on :4000
cd frontend && npm install && npm run dev                                     # UI on :5173 (proxies /api)
```

## Configuration

All config is via environment variables — see [`.env.example`](.env.example) for the full
list (database, session secret, app origin, and the three metadata-source keys).

**`MARKETPLACE`** picks which second-hand marketplace(s) the *find deals / bundles* buttons
search, so titles and lot phrasing come out in each site's language. **Comma-separated** — each
value adds its own button (e.g. `MARKETPLACE=leboncoin,medimops,kleinanzeigen`). Values:
`leboncoin` (France, default), `kleinanzeigen` (Germany), `ebay-de`, `ebay-com`, `ebay-uk`,
`ebay-fr`, `marktplaats` (Netherlands), `wallapop` (Spain), `medimops` (German used-media shop),
`easycash` (French used-goods shop), or `none` to hide the buttons.

## Tech stack

- **Backend** — Node.js + TypeScript + Express, PostgreSQL (`pg`, plain SQL migrations).
- **Frontend** — React + Vite + TypeScript.
- **Packaging** — docker-compose (Postgres + backend + nginx). Works behind
  Cloudflare Tunnel / nginx / Traefik.

## Project docs

- [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) — founding spec.
- [`CHAT_SUMMARY.md`](CHAT_SUMMARY.md) — design reasoning.
- [`media-vault-prototype.html`](media-vault-prototype.html) — original design prototype.

## License

[AGPL-3.0](LICENSE) — anyone who offers this as a network service must share their changes
back to the community.
