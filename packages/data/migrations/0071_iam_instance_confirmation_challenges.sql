-- +goose Up
CREATE TABLE iam.instance_confirmation_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  module_id TEXT,
  state_fingerprint TEXT NOT NULL,
  phrase_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instance_confirmation_challenges_phrase_hash_chk
    CHECK (phrase_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT instance_confirmation_challenges_expiry_chk
    CHECK (expires_at > created_at),
  CONSTRAINT instance_confirmation_challenges_consumed_chk
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX idx_instance_confirmation_challenges_pending_expiry
  ON iam.instance_confirmation_challenges(expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX idx_instance_confirmation_challenges_instance_actor
  ON iam.instance_confirmation_challenges(instance_id, actor_id, action_id, module_id, created_at DESC);

-- +goose Down
DROP INDEX IF EXISTS iam.idx_instance_confirmation_challenges_instance_actor;
DROP INDEX IF EXISTS iam.idx_instance_confirmation_challenges_pending_expiry;
DROP TABLE IF EXISTS iam.instance_confirmation_challenges;
