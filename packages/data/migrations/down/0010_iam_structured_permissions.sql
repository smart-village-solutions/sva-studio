DROP INDEX IF EXISTS iam.idx_permissions_instance_action_resource_effect;

ALTER TABLE iam.permissions
  DROP CONSTRAINT IF EXISTS permissions_effect_chk;

ALTER TABLE iam.permissions
  DROP COLUMN IF EXISTS scope,
  DROP COLUMN IF EXISTS effect,
  DROP COLUMN IF EXISTS resource_id,
  DROP COLUMN IF EXISTS resource_type,
  DROP COLUMN IF EXISTS action;
