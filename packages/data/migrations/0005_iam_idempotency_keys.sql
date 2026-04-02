-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS iam.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  actor_account_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  response_status INTEGER,
  response_body JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT idempotency_keys_status_chk CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
  CONSTRAINT idempotency_keys_actor_membership_fk FOREIGN KEY (instance_id, actor_account_id)
    REFERENCES iam.instance_memberships(instance_id, account_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_keys_scope
  ON iam.idempotency_keys(actor_account_id, endpoint, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON iam.idempotency_keys(expires_at);

ALTER TABLE iam.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.idempotency_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS idempotency_keys_isolation_policy ON iam.idempotency_keys;
CREATE POLICY idempotency_keys_isolation_policy
  ON iam.idempotency_keys
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS idempotency_keys_isolation_policy ON iam.idempotency_keys;
DROP TABLE IF EXISTS iam.idempotency_keys;
-- +goose StatementEnd
