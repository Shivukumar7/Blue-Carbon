-- ============================================================================
-- Blue Carbon Registry — schema
-- Geometry is stored as GeoJSON in JSONB so no PostGIS install is required.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('admin','leader','member')),
  village       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communities (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  leader_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  district     TEXT,
  state        TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leader -> member invitations. A member is only "active" once they accept.
CREATE TABLE IF NOT EXISTS community_members (
  id            SERIAL PRIMARY KEY,
  community_id  INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','declined')),
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at  TIMESTAMPTZ,
  UNIQUE (community_id, user_id)
);
-- A member may only belong to one community at a time (once accepted).
CREATE UNIQUE INDEX IF NOT EXISTS one_active_community_per_member
  ON community_members(user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS applications (
  id              SERIAL PRIMARY KEY,
  community_id    INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  ecosystem       TEXT NOT NULL DEFAULT 'mangrove'
                    CHECK (ecosystem IN ('mangrove','seagrass','saltmarsh')),
  proposed_area   JSONB NOT NULL,          -- GeoJSON Polygon
  area_hectares   NUMERIC(12,3) NOT NULL,
  member_count    INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted','site_visit_scheduled','site_visited','approved','rejected')),
  review_note     TEXT,
  reviewer_id     INTEGER REFERENCES users(id),
  visit_date      DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS projects (
  id                SERIAL PRIMARY KEY,
  application_id    INTEGER NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  community_id      INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  code              TEXT UNIQUE NOT NULL,   -- e.g. BCR-2026-0007
  name              TEXT NOT NULL,
  ecosystem         TEXT NOT NULL,
  boundary          JSONB NOT NULL,         -- GeoJSON Polygon approved by admin
  area_hectares     NUMERIC(12,3) NOT NULL,
  -- tCO2e sequestered per hectare per year for this ecosystem
  sequestration_rate NUMERIC(8,3) NOT NULL DEFAULT 6.500,
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_years    INTEGER NOT NULL DEFAULT 2,
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','matured','listed','sold')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,             -- e.g. A3
  geometry       JSONB NOT NULL,            -- GeoJSON Polygon
  centroid_lat   DOUBLE PRECISION NOT NULL,
  centroid_lng   DOUBLE PRECISION NOT NULL,
  area_hectares  NUMERIC(12,4) NOT NULL,
  assigned_to    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (project_id, label)
);
CREATE INDEX IF NOT EXISTS chunks_assigned_idx ON chunks(assigned_to);

CREATE TABLE IF NOT EXISTS daily_entries (
  id             SERIAL PRIMARY KEY,
  chunk_id       INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date     DATE NOT NULL,
  photo_path     TEXT NOT NULL,
  temperature_c  NUMERIC(5,2) NOT NULL,
  humidity_pct   NUMERIC(5,2) NOT NULL,
  soil_moisture_pct NUMERIC(5,2) NOT NULL,
  soil_ph        NUMERIC(4,2),
  salinity_ppt   NUMERIC(6,2),
  saplings_planted INTEGER NOT NULL DEFAULT 0,
  watered        BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chunk_id, entry_date)
);
CREATE INDEX IF NOT EXISTS entries_project_date_idx ON daily_entries(project_id, entry_date);

-- One row per (user, day, role). Members earn 1.0, leaders earn 2.0 x participation.
CREATE TABLE IF NOT EXISTS credits (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role               TEXT NOT NULL CHECK (role IN ('member','leader')),
  credit_date        DATE NOT NULL,
  amount             NUMERIC(8,3) NOT NULL,
  participation_rate NUMERIC(5,4),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, credit_date, role)
);
CREATE INDEX IF NOT EXISTS credits_project_idx ON credits(project_id);

CREATE TABLE IF NOT EXISTS listings (
  id                SERIAL PRIMARY KEY,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tonnes_available  NUMERIC(12,3) NOT NULL,
  tonnes_sold       NUMERIC(12,3) NOT NULL DEFAULT 0,
  price_per_tonne   NUMERIC(10,2) NOT NULL,
  vintage_year      INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','sold_out','closed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  reference      TEXT UNIQUE NOT NULL,
  listing_id     INTEGER NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_name     TEXT NOT NULL,
  buyer_email    TEXT NOT NULL,
  buyer_org      TEXT,
  buyer_phone    TEXT,
  buyer_country  TEXT,
  tonnes         NUMERIC(12,3) NOT NULL,
  total_amount   NUMERIC(12,2) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed')),
  retire_credits BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Settlement detail for marketplace orders. Added after the initial release,
-- so these run as idempotent ALTERs rather than being folded into the table
-- definition above — `npm run migrate` upgrades an existing database in place.
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method    TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal          NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_amount        NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount        NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS serial_start      INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS serial_end        INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS beneficiary       TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS retired_at        TIMESTAMPTZ;
