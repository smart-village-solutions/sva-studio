-- +goose Up
-- +goose StatementBegin
CREATE TABLE iam.instance_plugin_lifecycle (
  instance_id TEXT NOT NULL REFERENCES iam.instances(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  access_state TEXT NOT NULL DEFAULT 'active',
  readiness_status TEXT NOT NULL DEFAULT 'pending',
  desired_operation TEXT NOT NULL DEFAULT 'provision',
  desired_generation BIGINT NOT NULL DEFAULT 1,
  completed_generation BIGINT NOT NULL DEFAULT 0,
  claimed_generation BIGINT,
  active_job_id UUID,
  readiness_revision TEXT,
  readiness_checks JSONB NOT NULL DEFAULT '[]'::JSONB,
  error_code TEXT,
  retry_kind TEXT,
  retry_after TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (instance_id, plugin_id),
  CONSTRAINT instance_plugin_lifecycle_plugin_id_chk
    CHECK (plugin_id ~ '^[a-z][a-z0-9-]{1,30}$'),
  CONSTRAINT instance_plugin_lifecycle_access_state_chk
    CHECK (access_state IN ('active', 'suspended')),
  CONSTRAINT instance_plugin_lifecycle_readiness_status_chk
    CHECK (readiness_status IN ('pending', 'ready', 'degraded', 'blocked')),
  CONSTRAINT instance_plugin_lifecycle_operation_chk
    CHECK (desired_operation IN ('provision', 'reconcile', 'suspend', 'reactivate', 'readiness')),
  CONSTRAINT instance_plugin_lifecycle_generation_chk
    CHECK (
      desired_generation >= 1
      AND completed_generation >= 0
      AND completed_generation <= desired_generation
      AND (claimed_generation IS NULL OR claimed_generation BETWEEN 1 AND desired_generation)
    ),
  CONSTRAINT instance_plugin_lifecycle_claim_chk
    CHECK ((active_job_id IS NULL) = (claimed_generation IS NULL)),
  CONSTRAINT instance_plugin_lifecycle_retry_chk
    CHECK (
      (retry_kind IS NULL AND retry_after IS NULL)
      OR (retry_kind = 'terminal' AND retry_after IS NULL)
      OR retry_kind = 'retryable'
    ),
  CONSTRAINT instance_plugin_lifecycle_readiness_checks_chk
    CHECK (jsonb_typeof(readiness_checks) = 'array'),
  CONSTRAINT instance_plugin_lifecycle_job_fk
    FOREIGN KEY (active_job_id, instance_id)
    REFERENCES iam.studio_jobs(id, instance_id)
);

CREATE INDEX idx_instance_plugin_lifecycle_status_updated_at
  ON iam.instance_plugin_lifecycle(readiness_status, updated_at DESC);

CREATE UNIQUE INDEX idx_instance_plugin_lifecycle_active_job
  ON iam.instance_plugin_lifecycle(active_job_id)
  WHERE active_job_id IS NOT NULL;

ALTER TABLE iam.instance_plugin_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.instance_plugin_lifecycle FORCE ROW LEVEL SECURITY;
CREATE POLICY instance_plugin_lifecycle_isolation_policy
  ON iam.instance_plugin_lifecycle
  USING (instance_id = iam.current_instance_id())
  WITH CHECK (instance_id = iam.current_instance_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP POLICY IF EXISTS instance_plugin_lifecycle_isolation_policy
  ON iam.instance_plugin_lifecycle;
DROP INDEX IF EXISTS iam.idx_instance_plugin_lifecycle_active_job;
DROP INDEX IF EXISTS iam.idx_instance_plugin_lifecycle_status_updated_at;
DROP TABLE IF EXISTS iam.instance_plugin_lifecycle;
-- +goose StatementEnd
