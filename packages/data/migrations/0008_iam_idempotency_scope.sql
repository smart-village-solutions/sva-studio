-- +goose Up
-- +goose StatementBegin
DROP INDEX IF EXISTS uq_idempotency_keys_scope;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_keys_scope
  ON iam.idempotency_keys(instance_id, actor_account_id, endpoint, idempotency_key);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS uq_idempotency_keys_scope;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_keys_scope
  ON iam.idempotency_keys(actor_account_id, endpoint, idempotency_key);
-- +goose StatementEnd
