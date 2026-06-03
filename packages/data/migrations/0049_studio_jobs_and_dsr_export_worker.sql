-- +goose Up
-- +goose StatementBegin
ALTER TABLE IF EXISTS iam.plugin_operation_jobs RENAME TO studio_jobs;
ALTER TABLE IF EXISTS iam.plugin_operation_job_events RENAME TO studio_job_events;

ALTER INDEX IF EXISTS iam.plugin_operation_jobs_pkey RENAME TO studio_jobs_pkey;
ALTER INDEX IF EXISTS iam.plugin_operation_job_events_pkey RENAME TO studio_job_events_pkey;
ALTER INDEX IF EXISTS iam.idx_plugin_operation_jobs_id_instance RENAME TO idx_studio_jobs_id_instance;
ALTER INDEX IF EXISTS iam.idx_plugin_operation_jobs_instance_created_at RENAME TO idx_studio_jobs_instance_created_at;
ALTER INDEX IF EXISTS iam.idx_plugin_operation_jobs_instance_heartbeat_at RENAME TO idx_studio_jobs_instance_heartbeat_at;
ALTER INDEX IF EXISTS iam.idx_plugin_operation_jobs_instance_idempotency_key RENAME TO idx_studio_jobs_instance_idempotency_key;
ALTER INDEX IF EXISTS iam.idx_plugin_operation_jobs_instance_status_updated_at RENAME TO idx_studio_jobs_instance_status_updated_at;
ALTER INDEX IF EXISTS iam.idx_plugin_operation_jobs_parent_job_id RENAME TO idx_studio_jobs_parent_job_id;
ALTER INDEX IF EXISTS iam.idx_plugin_operation_job_events_job_created_at RENAME TO idx_studio_job_events_job_created_at;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plugin_operation_jobs_status_check'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      RENAME CONSTRAINT plugin_operation_jobs_status_check TO studio_jobs_status_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plugin_operation_jobs_attempts_check'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      RENAME CONSTRAINT plugin_operation_jobs_attempts_check TO studio_jobs_attempts_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plugin_operation_jobs_max_attempts_check'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      RENAME CONSTRAINT plugin_operation_jobs_max_attempts_check TO studio_jobs_max_attempts_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plugin_operation_jobs_parent_job_fk'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      RENAME CONSTRAINT plugin_operation_jobs_parent_job_fk TO studio_jobs_parent_job_fk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plugin_operation_job_events_status_check'
      AND conrelid = 'iam.studio_job_events'::regclass
  ) THEN
    ALTER TABLE iam.studio_job_events
      RENAME CONSTRAINT plugin_operation_job_events_status_check TO studio_job_events_status_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plugin_operation_job_events_type_check'
      AND conrelid = 'iam.studio_job_events'::regclass
  ) THEN
    ALTER TABLE iam.studio_job_events
      RENAME CONSTRAINT plugin_operation_job_events_type_check TO studio_job_events_type_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'plugin_operation_job_events_job_instance_fk'
      AND conrelid = 'iam.studio_job_events'::regclass
  ) THEN
    ALTER TABLE iam.studio_job_events
      RENAME CONSTRAINT plugin_operation_job_events_job_instance_fk TO studio_job_events_job_instance_fk;
  END IF;
END $$;

ALTER TABLE IF EXISTS iam.studio_jobs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'plugin',
  ALTER COLUMN plugin_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_jobs_source_check'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      ADD CONSTRAINT studio_jobs_source_check
      CHECK (source IN ('plugin', 'host'));
  END IF;
END $$;

ALTER TABLE IF EXISTS iam.data_subject_export_jobs
  ADD COLUMN IF NOT EXISTS studio_job_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_subject_export_jobs_studio_job_id
  ON iam.data_subject_export_jobs(studio_job_id)
  WHERE studio_job_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'data_subject_export_jobs_studio_job_fk'
      AND conrelid = 'iam.data_subject_export_jobs'::regclass
  ) THEN
    ALTER TABLE iam.data_subject_export_jobs
      ADD CONSTRAINT data_subject_export_jobs_studio_job_fk
      FOREIGN KEY (studio_job_id) REFERENCES iam.studio_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE IF EXISTS iam.data_subject_export_jobs
  DROP CONSTRAINT IF EXISTS data_subject_export_jobs_studio_job_fk;

DROP INDEX IF EXISTS iam.idx_data_subject_export_jobs_studio_job_id;

ALTER TABLE IF EXISTS iam.data_subject_export_jobs
  DROP COLUMN IF EXISTS studio_job_id;

ALTER TABLE IF EXISTS iam.studio_jobs
  DROP CONSTRAINT IF EXISTS studio_jobs_source_check;

UPDATE iam.studio_jobs
SET plugin_id = COALESCE(plugin_id, 'host-runtime')
WHERE plugin_id IS NULL;

ALTER TABLE IF EXISTS iam.studio_jobs
  DROP COLUMN IF EXISTS source,
  ALTER COLUMN plugin_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_jobs_status_check'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      RENAME CONSTRAINT studio_jobs_status_check TO plugin_operation_jobs_status_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_jobs_attempts_check'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      RENAME CONSTRAINT studio_jobs_attempts_check TO plugin_operation_jobs_attempts_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_jobs_max_attempts_check'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      RENAME CONSTRAINT studio_jobs_max_attempts_check TO plugin_operation_jobs_max_attempts_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_jobs_parent_job_fk'
      AND conrelid = 'iam.studio_jobs'::regclass
  ) THEN
    ALTER TABLE iam.studio_jobs
      RENAME CONSTRAINT studio_jobs_parent_job_fk TO plugin_operation_jobs_parent_job_fk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_job_events_status_check'
      AND conrelid = 'iam.studio_job_events'::regclass
  ) THEN
    ALTER TABLE iam.studio_job_events
      RENAME CONSTRAINT studio_job_events_status_check TO plugin_operation_job_events_status_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_job_events_type_check'
      AND conrelid = 'iam.studio_job_events'::regclass
  ) THEN
    ALTER TABLE iam.studio_job_events
      RENAME CONSTRAINT studio_job_events_type_check TO plugin_operation_job_events_type_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'studio_job_events_job_instance_fk'
      AND conrelid = 'iam.studio_job_events'::regclass
  ) THEN
    ALTER TABLE iam.studio_job_events
      RENAME CONSTRAINT studio_job_events_job_instance_fk TO plugin_operation_job_events_job_instance_fk;
  END IF;
END $$;

ALTER INDEX IF EXISTS iam.studio_jobs_pkey RENAME TO plugin_operation_jobs_pkey;
ALTER INDEX IF EXISTS iam.studio_job_events_pkey RENAME TO plugin_operation_job_events_pkey;
ALTER INDEX IF EXISTS iam.idx_studio_jobs_id_instance RENAME TO idx_plugin_operation_jobs_id_instance;
ALTER INDEX IF EXISTS iam.idx_studio_jobs_instance_created_at RENAME TO idx_plugin_operation_jobs_instance_created_at;
ALTER INDEX IF EXISTS iam.idx_studio_jobs_instance_heartbeat_at RENAME TO idx_plugin_operation_jobs_instance_heartbeat_at;
ALTER INDEX IF EXISTS iam.idx_studio_jobs_instance_idempotency_key RENAME TO idx_plugin_operation_jobs_instance_idempotency_key;
ALTER INDEX IF EXISTS iam.idx_studio_jobs_instance_status_updated_at RENAME TO idx_plugin_operation_jobs_instance_status_updated_at;
ALTER INDEX IF EXISTS iam.idx_studio_jobs_parent_job_id RENAME TO idx_plugin_operation_jobs_parent_job_id;
ALTER INDEX IF EXISTS iam.idx_studio_job_events_job_created_at RENAME TO idx_plugin_operation_job_events_job_created_at;

ALTER TABLE IF EXISTS iam.studio_job_events RENAME TO plugin_operation_job_events;
ALTER TABLE IF EXISTS iam.studio_jobs RENAME TO plugin_operation_jobs;
-- +goose StatementEnd
