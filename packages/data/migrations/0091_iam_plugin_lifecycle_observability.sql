-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iam_observability') THEN
    RAISE EXCEPTION 'iam_observability_role_already_exists';
  END IF;

  CREATE ROLE iam_observability NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
END
$$;

GRANT USAGE ON SCHEMA iam TO iam_observability;
GRANT SELECT (
  active_job_id,
  completed_generation,
  desired_generation,
  next_recheck_at,
  readiness_status,
  retry_after,
  retry_kind,
  started_at,
  updated_at
) ON iam.instance_plugin_lifecycle TO iam_observability;
GRANT SELECT (
  heartbeat_at,
  id,
  scheduled_at,
  started_at,
  status
) ON iam.studio_jobs TO iam_observability;

DROP POLICY IF EXISTS instance_plugin_lifecycle_observability_policy
  ON iam.instance_plugin_lifecycle;
CREATE POLICY instance_plugin_lifecycle_observability_policy
  ON iam.instance_plugin_lifecycle
  FOR SELECT
  TO iam_observability
  USING (true);

DROP POLICY IF EXISTS studio_jobs_observability_policy ON iam.studio_jobs;
CREATE POLICY studio_jobs_observability_policy
  ON iam.studio_jobs
  FOR SELECT
  TO iam_observability
  USING (true);

CREATE OR REPLACE FUNCTION iam.plugin_tenant_lifecycle_observability_snapshot()
RETURNS TABLE(reason_code text, stall_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, iam
SET statement_timeout = '10s'
AS $function$
  WITH lifecycle_jobs AS MATERIALIZED (
    SELECT
      lifecycle.active_job_id,
      lifecycle.completed_generation,
      lifecycle.desired_generation,
      lifecycle.next_recheck_at,
      lifecycle.readiness_status,
      lifecycle.retry_after,
      lifecycle.retry_kind,
      lifecycle.started_at AS lifecycle_started_at,
      lifecycle.updated_at AS lifecycle_updated_at,
      job.heartbeat_at,
      job.id AS job_id,
      job.scheduled_at,
      job.started_at AS job_started_at,
      job.status AS job_status
    FROM iam.instance_plugin_lifecycle AS lifecycle
    LEFT JOIN iam.studio_jobs AS job
      ON job.id = lifecycle.active_job_id
  )
  SELECT 'stale_claim'::text, count(*)::bigint
  FROM lifecycle_jobs
  WHERE active_job_id IS NOT NULL
    AND job_status = 'running'
    AND coalesce(heartbeat_at, job_started_at, lifecycle_started_at, lifecycle_updated_at)
      <= statement_timestamp() - interval '120 seconds'
  UNION ALL
  SELECT 'queued_due'::text, count(*)::bigint
  FROM lifecycle_jobs
  WHERE active_job_id IS NOT NULL
    AND job_status = 'queued'
    AND scheduled_at <= statement_timestamp() - interval '120 seconds'
  UNION ALL
  SELECT 'retry_due'::text, count(*)::bigint
  FROM lifecycle_jobs
  WHERE retry_kind = 'retryable'
    AND retry_after <= statement_timestamp()
  UNION ALL
  SELECT 'pending_recheck_due'::text, count(*)::bigint
  FROM lifecycle_jobs
  WHERE readiness_status = 'pending'
    AND active_job_id IS NULL
    AND next_recheck_at <= statement_timestamp()
  UNION ALL
  SELECT 'generation_without_owner'::text, count(*)::bigint
  FROM lifecycle_jobs
  WHERE desired_generation > completed_generation
    AND (
      active_job_id IS NULL
      OR job_id IS NULL
      OR job_status IN ('succeeded', 'failed', 'cancelled')
    )
    AND NOT (
      (retry_kind = 'retryable' AND retry_after > statement_timestamp())
      OR (readiness_status = 'pending' AND next_recheck_at > statement_timestamp())
    );
$function$;

GRANT CREATE ON SCHEMA iam TO iam_observability;
ALTER FUNCTION iam.plugin_tenant_lifecycle_observability_snapshot() OWNER TO iam_observability;
REVOKE CREATE ON SCHEMA iam FROM iam_observability;
REVOKE ALL ON FUNCTION iam.plugin_tenant_lifecycle_observability_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.plugin_tenant_lifecycle_observability_snapshot() TO iam_app;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
REVOKE EXECUTE ON FUNCTION iam.plugin_tenant_lifecycle_observability_snapshot() FROM iam_app;
DROP FUNCTION IF EXISTS iam.plugin_tenant_lifecycle_observability_snapshot();
DROP POLICY IF EXISTS studio_jobs_observability_policy ON iam.studio_jobs;
DROP POLICY IF EXISTS instance_plugin_lifecycle_observability_policy
  ON iam.instance_plugin_lifecycle;
REVOKE SELECT (
  heartbeat_at,
  id,
  scheduled_at,
  started_at,
  status
) ON iam.studio_jobs FROM iam_observability;
REVOKE SELECT (
  active_job_id,
  completed_generation,
  desired_generation,
  next_recheck_at,
  readiness_status,
  retry_after,
  retry_kind,
  started_at,
  updated_at
) ON iam.instance_plugin_lifecycle FROM iam_observability;
REVOKE USAGE ON SCHEMA iam FROM iam_observability;
DROP ROLE IF EXISTS iam_observability;
-- +goose StatementEnd
