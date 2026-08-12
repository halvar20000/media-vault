-- media-vault schema. Idempotent: safe to run on every boot.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()

-- Users of THIS instance (e.g. a household). No global accounts.
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shared cache of fetched metadata: each (source, source_key) fetched once, globally.
CREATE TABLE IF NOT EXISTS metadata_cache (
  source      TEXT NOT NULL,             -- igdb | tmdb | discogs
  source_key  TEXT NOT NULL,             -- normalized lookup key (e.g. lowercased title)
  source_id   TEXT,                      -- provider's own id for the matched release
  cover_url   TEXT,
  rating      NUMERIC(4,1),              -- normalized 0..100
  description TEXT,
  payload     JSONB,                     -- raw provider response (for future fields)
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_key)
);

-- The unified item model across all media types.
CREATE TABLE IF NOT EXISTS items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,             -- game | movie | lp | single | cd
  title       TEXT NOT NULL,
  format      TEXT,                      -- platform / vinyl format (PS2, 4K UHD, 2xLP, ...)
  year        INT,
  catalog_no  TEXT,                      -- disc serial / matrix / cat number
  location    TEXT,                      -- where it physically lives
  condition   TEXT,                      -- loose / CIB / sealed / VG+ ...
  notes       TEXT,                      -- free notes (e.g. emulation status from seed)
  -- Auto-enriched fields (the hero feature):
  cover_url   TEXT,
  rating      NUMERIC(4,1),              -- 0..100
  description TEXT,
  source      TEXT,                      -- which provider enriched it
  source_id   TEXT,
  enriched_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS items_user_idx ON items(user_id);
CREATE INDEX IF NOT EXISTS items_type_idx ON items(type);
CREATE INDEX IF NOT EXISTS items_title_idx ON items(lower(title));

-- Cabinets: physical storage locations, modelled as entities (shelves, cabinets).
CREATE TABLE IF NOT EXISTS cabinets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cabinets_user_name_idx ON cabinets(user_id, lower(name));

-- Additive columns for physical-collector features (idempotent on existing DBs).
ALTER TABLE items ADD COLUMN IF NOT EXISTS disc_count       INT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_series        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS season_count     INT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS episode_count    INT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS lent_to          TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS lent_since       DATE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS viewed_at        TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS cabinet_id       UUID REFERENCES cabinets(id) ON DELETE SET NULL;
-- Cover caching: keep the original remote URL when we download a local copy.
ALTER TABLE items ADD COLUMN IF NOT EXISTS cover_source_url TEXT;
-- Barcode (EAN/UPC) — attachable to any item for exact identification.
ALTER TABLE items ADD COLUMN IF NOT EXISTS barcode TEXT;
CREATE INDEX IF NOT EXISTS items_barcode_idx ON items(barcode);
-- Wishlist: items you want but don't own yet (excluded from the owned collection).
ALTER TABLE items ADD COLUMN IF NOT EXISTS wishlist BOOLEAN NOT NULL DEFAULT false;
-- Valuation.
ALTER TABLE items ADD COLUMN IF NOT EXISTS value          NUMERIC(10,2);
ALTER TABLE items ADD COLUMN IF NOT EXISTS value_currency TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS value_source   TEXT;    -- pricecharting | discogs | manual
ALTER TABLE items ADD COLUMN IF NOT EXISTS value_manual   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS valued_at      TIMESTAMPTZ;

-- Instance-wide key/value settings (e.g. the configured shops/marketplaces).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session store table for connect-pg-simple.
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR NOT NULL COLLATE "default",
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON session(expire);
