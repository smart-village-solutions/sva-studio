-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD COLUMN IF NOT EXISTS auth_realm TEXT,
  ADD COLUMN IF NOT EXISTS auth_client_id TEXT,
  ADD COLUMN IF NOT EXISTS auth_issuer_url TEXT;

UPDATE iam.instances
SET
  auth_realm = COALESCE(NULLIF(auth_realm, ''), id),
  auth_client_id = COALESCE(NULLIF(auth_client_id, ''), 'sva-studio')
WHERE auth_realm IS NULL
   OR auth_realm = ''
   OR auth_client_id IS NULL
   OR auth_client_id = '';

ALTER TABLE iam.instances
  ALTER COLUMN auth_realm SET NOT NULL,
  ALTER COLUMN auth_client_id SET NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE IF EXISTS iam.instances
  DROP COLUMN IF EXISTS auth_issuer_url,
  DROP COLUMN IF EXISTS auth_client_id,
  DROP COLUMN IF EXISTS auth_realm;
-- +goose StatementEnd
