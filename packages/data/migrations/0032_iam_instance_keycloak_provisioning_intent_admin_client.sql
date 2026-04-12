-- +goose Up
-- +goose StatementBegin
ALTER TABLE IF EXISTS iam.instance_keycloak_provisioning_runs
  DROP CONSTRAINT IF EXISTS instance_keycloak_provisioning_runs_intent_chk;

ALTER TABLE iam.instance_keycloak_provisioning_runs
  ADD CONSTRAINT instance_keycloak_provisioning_runs_intent_chk CHECK (
    intent IN ('provision', 'provision_admin_client', 'reset_tenant_admin', 'rotate_client_secret')
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE IF EXISTS iam.instance_keycloak_provisioning_runs
  DROP CONSTRAINT IF EXISTS instance_keycloak_provisioning_runs_intent_chk;

ALTER TABLE iam.instance_keycloak_provisioning_runs
  ADD CONSTRAINT instance_keycloak_provisioning_runs_intent_chk CHECK (
    intent IN ('provision', 'reset_tenant_admin', 'rotate_client_secret')
  );
-- +goose StatementEnd
