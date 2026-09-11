export const staleKeycloakProvisioningRunRecoveryCte = `
stale_instances AS MATERIALIZED (
  SELECT DISTINCT instance_id
  FROM iam.instance_keycloak_provisioning_runs
  WHERE overall_status = 'running'
    AND updated_at < NOW() - INTERVAL '15 minutes'
),
recoverable_instances AS MATERIALIZED (
  SELECT instance_id
  FROM stale_instances
  WHERE pg_try_advisory_xact_lock(hashtextextended(instance_id, 0))
),
recovered_runs AS (
  UPDATE iam.instance_keycloak_provisioning_runs AS stale
  SET
    overall_status = 'failed',
    drift_summary = 'Provisioning-Lauf nach abgebrochenem Worker-Claim automatisch beendet.',
    updated_at = NOW()
  FROM recoverable_instances
  WHERE stale.instance_id = recoverable_instances.instance_id
    AND stale.overall_status = 'running'
    AND stale.updated_at < NOW() - INTERVAL '15 minutes'
  RETURNING stale.id
)`;

export const expiredPlannedKeycloakProvisioningRunRecoveryCte = `
expired_planned_instances AS MATERIALIZED (
  SELECT DISTINCT instance_id
  FROM iam.instance_keycloak_provisioning_runs
  WHERE overall_status = 'planned'
    AND created_at < $1::timestamptz
),
retirable_planned_instances AS MATERIALIZED (
  SELECT instance_id
  FROM expired_planned_instances
  WHERE pg_try_advisory_xact_lock(hashtextextended(instance_id, 0))
),
retired_planned_runs AS (
  UPDATE iam.instance_keycloak_provisioning_runs AS expired
  SET
    overall_status = 'failed',
    drift_summary = 'Provisioning-Lauf vor dem aktuellen lokalen Worker-Start automatisch beendet.',
    updated_at = NOW()
  FROM retirable_planned_instances
  WHERE expired.instance_id = retirable_planned_instances.instance_id
    AND expired.overall_status = 'planned'
    AND expired.created_at < $1::timestamptz
  RETURNING expired.id
)`;

export const buildKeycloakProvisioningRunRecoveryCtes = (includeExpiredPlannedRuns: boolean): string =>
  `${staleKeycloakProvisioningRunRecoveryCte},\n${
    includeExpiredPlannedRuns ? `${expiredPlannedKeycloakProvisioningRunRecoveryCte},\n` : ''
  }`;

export const buildClaimNextKeycloakProvisioningRunSql = (
  includeCreatedAtFilter: boolean
): string => `
WITH RECURSIVE ${buildKeycloakProvisioningRunRecoveryCtes(includeCreatedAtFilter)}eligible_candidates AS MATERIALIZED (
  SELECT
    candidate.id,
    candidate.instance_id,
    ROW_NUMBER() OVER (ORDER BY candidate.created_at ASC, candidate.id ASC) AS candidate_position
  FROM iam.instance_keycloak_provisioning_runs AS candidate
  WHERE candidate.overall_status = 'planned'
${includeCreatedAtFilter ? '    AND candidate.created_at >= $1::timestamptz\n' : ''}    AND NOT EXISTS (
      SELECT 1
      FROM iam.instance_keycloak_provisioning_runs AS active
      WHERE active.instance_id = candidate.instance_id
        AND active.overall_status = 'running'
        AND active.id NOT IN (SELECT id FROM recovered_runs)
    )
),
attempted_candidates AS (
  SELECT
    eligible.id,
    eligible.instance_id,
    eligible.candidate_position,
    pg_try_advisory_xact_lock(hashtextextended(eligible.instance_id, 0)) AS lock_acquired
  FROM eligible_candidates AS eligible
  WHERE eligible.candidate_position = 1

  UNION ALL

  SELECT
    eligible.id,
    eligible.instance_id,
    eligible.candidate_position,
    pg_try_advisory_xact_lock(hashtextextended(eligible.instance_id, 0)) AS lock_acquired
  FROM attempted_candidates AS previous
  INNER JOIN eligible_candidates AS eligible
    ON eligible.candidate_position = previous.candidate_position + 1
  WHERE NOT previous.lock_acquired
),
candidate_run AS MATERIALIZED (
  SELECT runs.id
  FROM attempted_candidates AS attempted
  INNER JOIN iam.instance_keycloak_provisioning_runs AS runs ON runs.id = attempted.id
  WHERE attempted.lock_acquired
  ORDER BY attempted.candidate_position
  FOR UPDATE OF runs SKIP LOCKED
  LIMIT 1
)
UPDATE iam.instance_keycloak_provisioning_runs AS runs
SET
  overall_status = 'running',
  updated_at = NOW()
FROM candidate_run
WHERE runs.id = candidate_run.id
RETURNING
  runs.id::text AS id,
  runs.instance_id,
  runs.mutation,
  runs.idempotency_key,
  runs.payload_fingerprint,
  runs.mode,
  runs.intent,
  runs.overall_status,
  runs.drift_summary,
  runs.request_id,
  runs.actor_id,
  runs.created_at::text,
  runs.updated_at::text;
`;
