# How we got here — design conversation summary

A readable recap of the reasoning behind My Physical Media Library, for project
context. (Not a raw transcript — a distilled narrative of the decisions.)

## Origin

The project grew out of building a silent living-room Bazzite gaming/emulation PC
and cataloging a large physical game collection from shelf photos (~513 games across
17 platforms -> `master_game_list.csv`). The natural next step: a single app to
catalog ALL physical media — games, movies, vinyl LPs, singles, CDs — since no
existing tool covers everything (Discogs = vinyl only, game trackers = games only,
movie apps = films only). Unifying them is the whole point.

## Key decisions and the reasoning

**1. It must be self-hosted and open-source — not a hosted SaaS.**
We initially considered a hosted "sign up and upload" service. On reflection the
audience settles it: people who collect *physical* media do so precisely because
they distrust digital-only, cloud-locked ownership. Asking them to upload everything
to someone else's website contradicts the entire reason they collect physically.
So the correct product is one they run on their OWN server, with their OWN data.
This also removes the GDPR/accounts/moderation/uptime/cost burden a solo maintainer
would otherwise carry, and lets the project outlive its founder. The maintainer runs
their own instance as the flagship user, not as a service operator.

**2. Model: "Jellyfin for physical-media collectors."**
Open-source code + docker-compose so anyone runs it on Unraid/Synology/Proxmox/VPS.
AGPL license. Users bring their own free API keys.

**3. Metadata is fetched per media type and unified.**
Games -> IGDB, Movies -> TMDB, Vinyl/CD -> Discogs, Game valuation -> PriceCharting.
Server-side cache so each title is fetched once. This per-type routing, unified into
one shelf, is the core value.

**4. Signature UI: the spine shelf.**
Because the collection was photographed as spines on shelves, the app's hero view
renders items as coloured spines (colour = platform/format), browsable like a real
shelf, with real disc serials as catalog numbers. A working HTML prototype exists
(`media-vault-prototype.html`) with a gallery view, search, type filters, detail
drawer, and an add-flow mock — seeded with real games plus example films/vinyl.

**5. Valuation is a planned feature.**
Rough estimate of the game collection: ~CHF 5,000-5,500, but heavily dependent on
condition/completeness (loose vs CIB swings value 3-5x) and region (the collection
is mostly PAL). A real per-item valuation needs a condition field + PriceCharting
lookups — a strong reason the app should track value live rather than guess.

**6. Build home: Claude Code, not chat.**
A project this size (backend + frontend + Docker + DB) belongs in a real repo built
with Claude Code against a local directory, then Git + deploy — not assembled
message by message in a chat window.

## Immediate next steps

1. Pick the name (Shelfd / Vitrine / My Physical Media Library) and check GitHub +
   domain availability.
2. Open this folder in Claude Code; use PROJECT_BRIEF.md as founding context.
3. Scaffold the repo (backend + frontend + docker-compose + README + AGPL LICENSE).
4. Data model + import master_game_list.csv as seed.
5. Games end-to-end (IGDB + PriceCharting), then films, then vinyl.

## Files in this folder

- `PROJECT_BRIEF.md`        — the founding spec (open first)
- `CHAT_SUMMARY.md`         — this narrative
- `media-vault-prototype.html` — working design prototype (open in a browser)
- `master_game_list.csv`   — 513-game seed dataset
