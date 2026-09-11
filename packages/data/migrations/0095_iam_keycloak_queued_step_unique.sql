-- +goose Up
-- +goose StatementBegin
CREATE UNIQUE INDEX idx_instance_keycloak_provisioning_steps_queued_unique
  ON iam.instance_keycloak_provisioning_steps (run_id)
  WHERE step_key = 'queued';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX iam.idx_instance_keycloak_provisioning_steps_queued_unique;
-- +goose StatementEnd
