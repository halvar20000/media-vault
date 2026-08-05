# My Physical Media Library — Project Brief

> Founding specification. Open this first in Claude Code — it is the project's
> source of truth for what we are building and why.

---

## One-line description

An **open-source, self-hosted** catalog for **physical media collections** —
video games, movies, vinyl LPs and singles, CDs — where the collector keeps
full control of their own data on their own server. Think **"Jellyfin /
Koillection for physical-media collectors."**

## Who it's for (and why the architecture follows from this)

The target user is a **collector of physical media**. This person chose physical
*precisely because* they distrust digital-only, cloud-locked, account-on-someone-
else's-website ownership. Asking them to upload their whole collection to a hosted
SaaS is asking them to do the exact thing their hobby is a reaction against.

**Therefore the product is self-hosted and open-source. This is not a hedge — it is
the correct fit for the audience.** Consequences, all positive for a solo maintainer:

- No central accounts, no cloud lock-in — their data lives on their machine.
- Removes GDPR / accounts / moderation / uptime burden from the maintainer.
- Near-zero running cost.
- Grows a contributor base (self-hosters contribute code).
- The project survives independently of the founder.

The maintainer runs their own instance like everyone else — **flagship user, not
service operator.**

## Explicitly NOT building

- A hosted multi-tenant SaaS where strangers sign up and upload to our servers.
- Anything that makes the maintainer a data controller for other people's accounts.

---

## Core features (v1 scope)

1. **Unified catalog** across media types (games, movies, vinyl LPs, singles, CDs)
   with one shared item model + type-specific fields.
2. **Auto-fetch metadata + cover art** from the right source per media type.
3. **Cataloging**: add / search / browse / edit.
4. **Visual browsing** — the signature "spine shelf" + a gallery/grid view.
5. **Three ways to add an item**: phone barcode scan, title search with auto-fill,
   CSV bulk import.
6. **Valuation** (stretch, high value): per-item current market value + running
   collection total, via PriceCharting (games) etc. Condition/completeness field
   (loose / CIB / sealed) because it swings value 3-5x.

## Signature design element

The **spine shelf**: items render as vertical coloured spines (colour = platform /
format), browsable horizontally, mirroring how collectors physically store and
photograph their collections. Real catalog numbers (disc serials like BLES-/CUSA-/
SLES-) used as the catalog-number field. A working HTML prototype is in
`media-vault-prototype.html`.

Design tokens from the prototype (starting point, not locked):
- bg #1B2430, surface #F3EEE3, ink #232A31, accent #E0A126
- type accents: games #4C9A5A, movies #3E7CB1, LP #C8681E, singles #A24E8F
- display Archivo, body IBM Plex Sans, mono IBM Plex Mono (catalog numbers)

---

## Metadata sources (the reason nothing off-the-shelf does everything)

Each medium has its own database; unifying them is the app's core value.
Users register their own free API keys (keeps it free, respects terms, keeps
control with the user).

| Media | Source | Notes |
|-------|--------|-------|
| Games | IGDB | free API; cover art + barcode/title search |
| Movies | TMDB | free; excellent posters/metadata |
| Vinyl LP / Singles / CD | Discogs | definitive music-release DB; barcode search |
| Game valuation | PriceCharting | loose / CIB / new, per-region (PAL matters) |

Server-side cache of fetched metadata so each title is fetched once, not once per
user/lookup — required for cost and API terms.

---

## Tech stack (built for multi-user-within-an-instance + self-host from day one)

- Backend: Node.js + TypeScript, REST/JSON API.
- Database: PostgreSQL.
- Frontend: SPA evolving the prototype's design (React/Svelte TBD).
- Auth: local login (email+password) with verification; multi-user WITHIN one
  self-hosted instance only (e.g. a household). No global accounts.
- Packaging: docker-compose — one command on Unraid / Synology / Proxmox / VPS.
  .env.example for config; no hardcoded secrets.
- Reverse proxy / TLS: works behind Cloudflare Tunnel / nginx.
- License: AGPL-3.0 (open; anyone offering it as a service must share changes back).

---

## Build roadmap (order matters)

1. Scaffold — repo skeleton: backend + frontend + docker-compose.yml +
   .env.example + README + LICENSE (AGPL). Clean, config-driven, no secrets.
2. Data model + CSV import — Postgres unified item model; import the 513-game seed
   (master_game_list.csv) as demo/seed data.
3. Games end-to-end — IGDB metadata + PriceCharting valuation, real auth,
   self-hostable, spine-shelf + gallery views working.
4. Films (TMDB), then vinyl/CD (Discogs).
5. Add flows — barcode scanning in the browser (no app install), title search,
   CSV import UI.
6. Polish + docs — self-host guide, screenshots, first public release.

---

## Seed data

`master_game_list.csv` — 513 real games across 17 platforms, tagged by platform and
emulation status. Use as demo/seed and first real import test.

## Naming

Working name: My Physical Media Library. Short brandable candidates discussed:
Shelfd (ties to the shelf view), Vitrine (display cabinet), Tangible, Physica.
Decision pending — check GitHub org + domain availability before locking.

## How to build this

Real repo, not a chat project. Build with Claude Code against this directory:
scaffold, iterate locally, commit to Git, push to GitHub, deploy to the
maintainer's own server (Hetzner VPS or home Unraid).

---
*Generated from the design conversation. See CHAT_SUMMARY.md for the narrative.*
