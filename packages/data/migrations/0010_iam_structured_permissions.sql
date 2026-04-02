-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.permissions
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS effect TEXT NOT NULL DEFAULT 'allow',
  ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE iam.permissions
SET
  action = COALESCE(NULLIF(action, ''), permission_key),
  resource_type = COALESCE(NULLIF(resource_type, ''), split_part(permission_key, '.', 1)),
  scope = COALESCE(scope, '{}'::jsonb)
WHERE action IS NULL
   OR action = ''
   OR resource_type IS NULL
   OR resource_type = ''
   OR scope IS NULL;

ALTER TABLE iam.permissions
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN resource_type SET NOT NULL,
  ALTER COLUMN effect SET DEFAULT 'allow',
  ALTER COLUMN scope SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'permissions_effect_chk'
      AND conrelid = 'iam.permissions'::regclass
  ) THEN
    ALTER TABLE iam.permissions
      ADD CONSTRAINT permissions_effect_chk
      CHECK (effect IN ('allow', 'deny'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_permissions_instance_action_resource_effect
  ON iam.permissions(instance_id, action, resource_type, effect);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_permissions_instance_action_resource_effect;

ALTER TABLE iam.permissions
  DROP CONSTRAINT IF EXISTS permissions_effect_chk;

ALTER TABLE iam.permissions
  DROP COLUMN IF EXISTS scope,
  DROP COLUMN IF EXISTS effect,
  DROP COLUMN IF EXISTS resource_id,
  DROP COLUMN IF EXISTS resource_type,
  DROP COLUMN IF EXISTS action;
-- +goose StatementEnd
