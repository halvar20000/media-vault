# media-vault — Installation & Setup Guide

A step-by-step walkthrough: install the app (plus its database), get the free
artwork keys, and add them in the app. Plan for about **10–15 minutes**.

> **The short version**
> 1. Install a **PostgreSQL 16** container.
> 2. Install **media-vault**, point it at that database, set your login.
> 3. (Optional) grab free API keys and paste them into **⚙ Settings → API keys** —
>    that's what unlocks cover art, ratings, and the games catalogue.
>
> The app runs without any keys; enrichment simply stays idle until you add them.

---

## 1. Install on Unraid (Community Applications)

### Step 1 — Install PostgreSQL 16 (do this first)

media-vault stores everything in a PostgreSQL database, in its own container.

1. **Apps** tab → search **`postgresql16`** → install the official one.
2. Set these (remember them — you'll type them into media-vault next):
   - **POSTGRES_USER** → e.g. `mediavault`
   - **POSTGRES_PASSWORD** → a password you choose
   - **POSTGRES_DB** → e.g. `mediavault`
3. Leave the port at **5432** unless it's already taken (then pick e.g. `5433`).
4. Apply and let it start.

### Step 2 — Install media-vault

1. **Apps** tab → search **`media-vault`** → install.
2. Fill in the fields:

   | Field | What to enter |
   |-------|---------------|
   | **WebUI Port** | A free port, e.g. `8080` |
   | **DB Host** | Your Unraid server's IP, e.g. `192.168.1.10` (see note below) |
   | **DB Port** | `5432` (or whatever you set for Postgres) |
   | **DB Name / User / Password** | Match the Postgres container from Step 1 |
   | **Login email** | The email you'll log in with (default `admin@media-vault.local`) |
   | **Login password** | Your password — **change it from `changeme`** |
   | **Session Secret** | **Leave blank** — it's generated automatically |

3. Apply.

> **⚠ DB Host — the #1 gotcha.** On Unraid's default **bridge** network, containers
> can't reach each other by name. Use your **server's IP** as the DB Host (not
> `localhost`, not the container name). Alternatively, put both containers on the
> **same custom Docker network** and then you *can* use the Postgres container's name.

### Step 3 — First login

Open `http://YOUR-SERVER-IP:PORT` (the port from Step 2) and log in with the
**Login email / password** you set. You'll land on a shelf pre-seeded with a
starter games list.

*(Prefer docker-compose? A `docker-compose.yml` and `.env.example` are in the
[repo](https://github.com/halvar20000/media-vault) — same idea: one Postgres, one app.)*

---

## 2. Get the free API keys

These are **optional but recommended** — they unlock the hero features. All free.
You can add them now or any time later. Each row says what it unlocks:

| Source | Unlocks | Where to get it |
|--------|---------|-----------------|
| **IGDB** (via Twitch) | Game covers, ratings, **the games catalogue** | dev.twitch.tv |
| **TMDB** | Movie posters, ratings, descriptions | themoviedb.org |
| **Discogs** | Vinyl / CD art, ratings, **and valuation** | discogs.com |
| **eBay** (optional) | Free game **price estimates** | developer.ebay.com |

### IGDB (games) — via a Twitch application

IGDB is owned by Twitch, so you authenticate with a Twitch app.

1. Go to **https://dev.twitch.tv/console/apps** and sign in (create a free Twitch
   account if needed; you may have to enable 2FA).
2. Click **Register Your Application**.
   - **Name:** anything, e.g. `media-vault`
   - **OAuth Redirect URLs:** `http://localhost`
   - **Category:** Application Integration
3. Click **Create**, then **Manage** on your new app.
4. Copy the **Client ID**. Click **New Secret** and copy the **Client Secret**.

→ You now have **IGDB Client ID** and **IGDB Client Secret**.

### TMDB (movies)

1. Create a free account at **https://www.themoviedb.org/**.
2. Go to **Settings → API** (https://www.themoviedb.org/settings/api).
3. Request an API key — choose **Developer**, accept the terms, and fill in the
   short form (any personal/hobby details are fine).
4. On the API page, copy the **API Read Access Token** — the long token that
   starts with `eyJ…` (this is the v4 auth token media-vault uses).

→ You now have the **TMDB Access Token**.

### Discogs (vinyl / CD)

1. Sign in at **https://www.discogs.com/**.
2. Go to **Settings → Developers**
   (https://www.discogs.com/settings/developers).
3. Click **Generate new token** and copy the **personal access token**.

→ You now have the **Discogs token**. *(Advanced: you can instead register an app
for a Consumer Key + Secret — media-vault accepts either.)*

### eBay (free game price estimates — optional)

1. Create a free developer account at **https://developer.ebay.com/**.
2. Create an application / **Production** keyset.
3. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)**.

→ You now have the **eBay Client ID** and **eBay Client Secret**.

> ⏳ A new eBay **Production** keyset can take up to a day to activate. If the first
> lookup errors, wait a bit and try again.
> ℹ️ eBay prices are *active-listing* asking prices (a solid ballpark), not sold prices.

---

## 3. Add the keys in media-vault

No file editing — it's all in the app, and changes apply instantly.

1. Open media-vault and click the **⚙** button (top-right of the header).
2. Scroll to the **API keys** section. Each field shows **✓ configured** or
   **— not set**.
3. Paste each value into its field (they're **masked** — the app stores them on
   your server and never shows them back):
   - **Games — IGDB:** Client ID + Client Secret
   - **Movies — TMDB:** Read Access Token
   - **Music — Discogs:** token (or consumer key + secret)
   - **Game valuation — eBay:** Client ID + Client Secret
   - **Options:** TMDB language (e.g. `de-DE`), eBay marketplace (e.g. `EBAY_DE`),
     value currency (e.g. `EUR`)
4. Click **Save**.

That's it — the sources light up immediately:

- The **▤ Catalogue** button appears once IGDB is configured.
- Click **✦ Enrich collection** to fetch covers/ratings/descriptions for your items.
- Click **€ Value collection** to price games (eBay) and music (Discogs).

> To change or remove a key later, just open Settings again. Leaving a key field
> blank keeps the existing one; typing a new value replaces it.

---

## 4. Configure shops (optional)

**⚙ Settings → Shops** lets you pick which second-hand marketplaces the "find deal"
buttons search — tick presets for your country (leboncoin, eBay, Kleinanzeigen,
medimops, Easy Cash, GameStop, Craigslist…), set an Easy Cash store or Craigslist
city, or add your **own shop** by pasting a search URL with `{query}` in it.

---

## 5. Updating

- **Installed from Community Apps:** the **Docker** tab shows an update when a new
  version is published — click it (or right-click → **Force Update**).
- The running version is shown in the app header and at `GET /api/health`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| App won't start / "database" errors | Make sure the Postgres container is running and **DB Host is your server IP** (not a container name on bridge). Double-check DB name/user/password match. |
| No **Catalogue** button | Add the **IGDB** Client ID + Secret in ⚙ Settings, then Save. |
| Covers not appearing | Add the relevant key (IGDB/TMDB/Discogs), then click **✦ Enrich collection**. |
| eBay valuation errors on first try | A new Production keyset can take ~a day to activate — wait and retry. |
| Forgot the login | It's the **Login email / password** you set at install (default `admin@media-vault.local`). |

Questions or bugs: **https://github.com/halvar20000/media-vault/issues**
