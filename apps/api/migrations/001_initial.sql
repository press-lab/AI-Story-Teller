CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aist_meta (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aist_records (
  collection text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS aist_records_collection_idx
  ON aist_records (collection);

INSERT INTO aist_meta (key, value)
VALUES (
  'metadata',
  '{"schemaVersion":1,"migrations":[{"version":1,"name":"initial-backend-schema","appliedAt":"2026-07-05T00:00:00.000Z"}]}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
