-- +goose Up
-- +goose StatementBegin
WITH ranked_queued_steps AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY created_at ASC, id ASC) AS duplicate_rank
  FROM iam.instance_keycloak_provisioning_steps
  WHERE step_key = 'queued'
)
DELETE FROM iam.instance_keycloak_provisioning_steps AS steps
USING ranked_queued_steps AS ranked
WHERE steps.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX idx_instance_keycloak_provisioning_steps_queued_unique
  ON iam.instance_keycloak_provisioning_steps (run_id)
  WHERE step_key = 'queued';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX iam.idx_instance_keycloak_provisioning_steps_queued_unique;
-- +goose StatementEnd
