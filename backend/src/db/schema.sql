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

-- Session store table for connect-pg-simple.
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR NOT NULL COLLATE "default",
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON session(expire);
