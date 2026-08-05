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
docker compose up --build
```

Open **http://localhost:8080**, register a local user, then click **Enrich collection** to
pull covers/ratings/descriptions. The 513-game seed list (`master_game_list.csv`) is
imported automatically on first boot.

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
