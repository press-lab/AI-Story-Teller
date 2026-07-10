CREATE INDEX IF NOT EXISTS aist_sessions_token_hash_idx
  ON aist_records ((data->>'tokenHash'))
  WHERE collection = 'sessions';

CREATE UNIQUE INDEX IF NOT EXISTS aist_users_email_idx
  ON aist_records ((lower(data->>'email')))
  WHERE collection = 'users';

CREATE INDEX IF NOT EXISTS aist_adventures_owner_idx
  ON aist_records ((data->>'ownerUserId'), id)
  WHERE collection = 'adventures';

CREATE INDEX IF NOT EXISTS aist_scenarios_owner_idx
  ON aist_records ((data->>'ownerUserId'), id)
  WHERE collection IN ('scenarioDrafts', 'scenarioRevisions');

CREATE TABLE IF NOT EXISTS aist_idempotency (
  user_id text NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'succeeded', 'failed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS aist_idempotency_expiry_idx ON aist_idempotency (expires_at);

CREATE TABLE IF NOT EXISTS aist_rate_limits (
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (bucket_key, window_started_at)
);

CREATE INDEX IF NOT EXISTS aist_rate_limits_expiry_idx ON aist_rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS aist_oauth_exchange_codes (
  code_hash text PRIMARY KEY,
  user_id text NOT NULL,
  session_token text NOT NULL,
  session_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS aist_oauth_exchange_expiry_idx ON aist_oauth_exchange_codes (expires_at);
