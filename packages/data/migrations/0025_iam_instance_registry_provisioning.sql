-- +goose Up
-- +goose StatementBegin
ALTER TABLE iam.instances
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS parent_domain TEXT NOT NULL DEFAULT 'studio.smart-village.app',
  ADD COLUMN IF NOT EXISTS primary_hostname TEXT,
  ADD COLUMN IF NOT EXISTS theme_key TEXT,
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mainserver_config_ref TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT,
  ADD CONSTRAINT instances_status_chk CHECK (status IN ('requested', 'validated', 'provisioning', 'active', 'failed', 'suspended', 'archived'));

UPDATE iam.instances
SET primary_hostname = CONCAT(id, '.', parent_domain)
WHERE primary_hostname IS NULL;

ALTER TABLE iam.instances
  ALTER COLUMN primary_hostname SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_instances_primary_hostname
  ON iam.instances(primary_hostname);

CREATE TABLE IF NOT EXISTS iam.instance_hostnames (
  hostname TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_instance_hostnames_primary_per_instance
  ON iam.instance_hostnames(instance_id)
  WHERE is_primary = true;

INSERT INTO iam.instance_hostnames (hostname, instance_id, is_primary, created_by)
SELECT primary_hostname, id, true, COALESCE(created_by, 'migration:0025')
FROM iam.instances
ON CONFLICT (hostname) DO NOTHING;

CREATE TABLE IF NOT EXISTS iam.instance_provisioning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  step_key TEXT,
  idempotency_key TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  request_id TEXT,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT instance_provisioning_operation_chk CHECK (operation IN ('create', 'activate', 'suspend', 'archive')),
  CONSTRAINT instance_provisioning_status_chk CHECK (status IN ('requested', 'validated', 'provisioning', 'active', 'failed', 'suspended', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_instance_provisioning_runs_idempotency
  ON iam.instance_provisioning_runs(instance_id, operation, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_instance_provisioning_runs_instance_created
  ON iam.instance_provisioning_runs(instance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS iam.instance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  request_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instance_audit_events_instance_created
  ON iam.instance_audit_events(instance_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS iam.idx_instance_audit_events_instance_created;
DROP TABLE IF EXISTS iam.instance_audit_events;

DROP INDEX IF EXISTS iam.idx_instance_provisioning_runs_instance_created;
DROP INDEX IF EXISTS iam.uq_instance_provisioning_runs_idempotency;
DROP TABLE IF EXISTS iam.instance_provisioning_runs;

DROP INDEX IF EXISTS iam.uq_instance_hostnames_primary_per_instance;
DROP TABLE IF EXISTS iam.instance_hostnames;

DROP INDEX IF EXISTS iam.uq_instances_primary_hostname;

ALTER TABLE IF EXISTS iam.instances
  DROP CONSTRAINT IF EXISTS instances_status_chk,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS parent_domain,
  DROP COLUMN IF EXISTS primary_hostname,
  DROP COLUMN IF EXISTS theme_key,
  DROP COLUMN IF EXISTS feature_flags,
  DROP COLUMN IF EXISTS mainserver_config_ref,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by;
-- +goose StatementEnd
