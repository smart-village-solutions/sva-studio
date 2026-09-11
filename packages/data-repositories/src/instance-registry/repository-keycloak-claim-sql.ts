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
