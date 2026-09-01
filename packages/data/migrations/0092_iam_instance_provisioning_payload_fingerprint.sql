-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instance_provisioning_runs
  ADD COLUMN payload_fingerprint TEXT;

ALTER TABLE iam.instance_provisioning_runs
  ADD CONSTRAINT instance_provisioning_create_payload_fingerprint_chk
  CHECK (operation <> 'create' OR payload_fingerprint IS NOT NULL) NOT VALID;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.instance_provisioning_runs
  DROP CONSTRAINT IF EXISTS instance_provisioning_create_payload_fingerprint_chk;

ALTER TABLE iam.instance_provisioning_runs
  DROP COLUMN IF EXISTS payload_fingerprint;
-- +goose StatementEnd
