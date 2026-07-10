DROP TABLE IF EXISTS aist_oauth_exchange_codes;

CREATE UNIQUE INDEX IF NOT EXISTS aist_oauth_exchange_code_hash_idx
  ON aist_records ((data->>'codeHash'))
  WHERE collection = 'oauthExchangeCodes';

CREATE INDEX IF NOT EXISTS aist_restrictions_user_created_idx
  ON aist_records ((data->>'userId'), (data->>'createdAt') DESC)
  WHERE collection = 'accountRestrictions';

CREATE INDEX IF NOT EXISTS aist_safety_events_user_status_idx
  ON aist_records ((data->>'userId'), (data->>'status'), ((data->>'severity')::int))
  WHERE collection = 'accountSafetyEvents';

CREATE INDEX IF NOT EXISTS aist_snapshots_owner_adventure_idx
  ON aist_records ((data->>'userId'), (data->>'adventureId'), (data->>'createdAt') DESC)
  WHERE collection = 'adventureSnapshots';

CREATE UNIQUE INDEX IF NOT EXISTS aist_google_identity_subject_idx
  ON aist_records ((data->>'provider'), (data->>'providerSubject'))
  WHERE collection = 'authIdentities';

CREATE INDEX IF NOT EXISTS aist_verification_token_hash_idx
  ON aist_records ((data->>'tokenHash'))
  WHERE collection = 'verificationTokens';

CREATE INDEX IF NOT EXISTS aist_oauth_state_token_hash_idx
  ON aist_records ((data->>'tokenHash'))
  WHERE collection = 'oauthStates';

CREATE INDEX IF NOT EXISTS aist_invite_token_hash_idx
  ON aist_records ((data->>'tokenHash'))
  WHERE collection = 'inviteLinks';
