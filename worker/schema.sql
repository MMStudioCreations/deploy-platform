-- Full schema — run against a fresh D1 database:
--   wrangler d1 execute deploy-platform --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  category    TEXT    NOT NULL,
  preview_url TEXT,
  schema      TEXT    NOT NULL,
  r2_key      TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  template_id TEXT    NOT NULL REFERENCES templates(id),
  domain      TEXT,
  subdomain   TEXT,
  status      TEXT    NOT NULL DEFAULT 'draft',
  cf_pages_id TEXT,
  github_repo TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content (
  site_id    TEXT    PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  data       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_template  ON sites(template_id);
CREATE INDEX IF NOT EXISTS idx_sites_status    ON sites(status);
