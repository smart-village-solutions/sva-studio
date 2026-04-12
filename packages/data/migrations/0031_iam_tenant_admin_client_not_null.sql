-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam.instances
    WHERE NULLIF(BTRIM(tenant_admin_client_id), '') IS NULL
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = '0031_iam_tenant_admin_client_not_null requires a completed tenant admin client backfill before it can be applied.';
  END IF;
END
$$;

ALTER TABLE iam.instances
  ALTER COLUMN tenant_admin_client_id SET NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE iam.instances
  ALTER COLUMN tenant_admin_client_id DROP NOT NULL;
-- +goose StatementEnd
