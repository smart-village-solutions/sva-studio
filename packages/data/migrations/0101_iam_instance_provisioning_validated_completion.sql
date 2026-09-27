-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instance_provisioning_runs
  DROP CONSTRAINT instance_provisioning_completion_chk,
  ADD CONSTRAINT instance_provisioning_completion_chk CHECK (
    (status IN ('active', 'failed', 'suspended', 'archived') OR
      (status = 'validated' AND step_key = 'completed')) = (completed_at IS NOT NULL)
  ) NOT VALID;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM iam.instance_provisioning_runs
    WHERE status = 'validated' AND completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot restore old completion constraint while completed validated runs exist';
  END IF;

  ALTER TABLE iam.instance_provisioning_runs
    DROP CONSTRAINT instance_provisioning_completion_chk,
    ADD CONSTRAINT instance_provisioning_completion_chk CHECK (
      (status IN ('active', 'failed', 'suspended', 'archived')) = (completed_at IS NOT NULL)
    ) NOT VALID;
END;
$$;
-- +goose StatementEnd
