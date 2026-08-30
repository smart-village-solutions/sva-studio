export const getModuleActivationPolicySql = `
SELECT activation_policy, effective_active, state_revision
FROM iam.instance_modules
WHERE instance_id = $1 AND module_id = $2
LIMIT 1;
`;

export const assignModuleSql = `
WITH module_lock AS (
  SELECT pg_try_advisory_xact_lock(
    hashtextextended(json_build_array($1::text, $2::text)::text, 0)
  ) AS acquired
),
mutation AS (
INSERT INTO iam.instance_modules (
  instance_id, module_id, activation_origin, effective_active, manual_override
)
SELECT $1, $2, 'manual', true, 'enabled'
FROM module_lock WHERE acquired
ON CONFLICT (instance_id, module_id) DO UPDATE
SET activation_origin = 'manual', effective_active = true, manual_override = 'enabled',
  state_revision = iam.instance_modules.state_revision + 1,
  reconcile_id = NULL, reconciled_at = NULL, updated_at = now()
WHERE iam.instance_modules.activation_policy <> 'required'
  AND (NOT iam.instance_modules.effective_active
    OR iam.instance_modules.manual_override IS DISTINCT FROM 'enabled')
RETURNING 1
)
SELECT acquired, EXISTS (SELECT 1 FROM mutation) AS changed FROM module_lock;
`;

export const revokeModuleSql = `
WITH module_lock AS (
  SELECT pg_try_advisory_xact_lock(
    hashtextextended(json_build_array($1::text, $2::text)::text, 0)
  ) AS acquired
),
mutation AS (
UPDATE iam.instance_modules
SET activation_origin = 'manual', effective_active = false, manual_override = 'disabled',
  state_revision = state_revision + 1, reconcile_id = NULL, reconciled_at = NULL,
  updated_at = now()
WHERE instance_id = $1 AND module_id = $2 AND activation_policy <> 'required'
  AND effective_active AND (SELECT acquired FROM module_lock)
RETURNING 1
)
SELECT acquired, EXISTS (SELECT 1 FROM mutation) AS changed FROM module_lock;
`;

export const reconcileModuleActivationPolicySql = `
WITH module_lock AS (
  SELECT pg_try_advisory_xact_lock(
    hashtextextended(json_build_array($1::text, $2::text)::text, 0)
  ) AS acquired
),
mutation AS (
INSERT INTO iam.instance_modules (
  instance_id, module_id, activation_policy, activation_origin, effective_active,
  manual_override, manifest_version, policy_revision, state_revision, reconcile_id,
  reconciled_at, updated_at, updated_by
)
SELECT $1, $2, $3, 'policy_reconcile', $3 IN ('automatic', 'required'), NULL,
  $4, $5, 1, $6, now(), now(), $7
FROM module_lock WHERE acquired
ON CONFLICT (instance_id, module_id) DO UPDATE
SET activation_policy = EXCLUDED.activation_policy,
  activation_origin = 'policy_reconcile',
  effective_active = CASE
    WHEN EXCLUDED.activation_policy = 'required' THEN true
    WHEN iam.instance_modules.manual_override = 'enabled' THEN true
    WHEN iam.instance_modules.manual_override = 'disabled' THEN false
    ELSE EXCLUDED.activation_policy = 'automatic'
  END,
  manual_override = CASE
    WHEN EXCLUDED.activation_policy = 'required' THEN NULL
    ELSE iam.instance_modules.manual_override
  END,
  manifest_version = EXCLUDED.manifest_version,
  policy_revision = EXCLUDED.policy_revision,
  state_revision = iam.instance_modules.state_revision + 1,
  reconcile_id = EXCLUDED.reconcile_id,
  reconciled_at = EXCLUDED.reconciled_at,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by
WHERE iam.instance_modules.activation_policy IS DISTINCT FROM EXCLUDED.activation_policy
  OR iam.instance_modules.effective_active IS DISTINCT FROM CASE
    WHEN EXCLUDED.activation_policy = 'required' THEN true
    WHEN iam.instance_modules.manual_override = 'enabled' THEN true
    WHEN iam.instance_modules.manual_override = 'disabled' THEN false
    ELSE EXCLUDED.activation_policy = 'automatic'
  END
  OR (EXCLUDED.activation_policy = 'required'
    AND iam.instance_modules.manual_override IS NOT NULL)
  OR iam.instance_modules.manifest_version IS DISTINCT FROM EXCLUDED.manifest_version
  OR iam.instance_modules.policy_revision IS DISTINCT FROM EXCLUDED.policy_revision
RETURNING 1
)
SELECT acquired, EXISTS (SELECT 1 FROM mutation) AS changed FROM module_lock;
`;

export const deactivateOmittedModuleActivationPoliciesSql = `
WITH candidates AS MATERIALIZED (
  SELECT module_id
  FROM iam.instance_modules
  WHERE instance_id = $1
    AND NOT ($2::jsonb ? module_id)
),
module_locks AS MATERIALIZED (
  SELECT module_id,
    pg_try_advisory_xact_lock(
      hashtextextended(json_build_array($1::text, module_id)::text, 0)
    ) AS acquired
  FROM candidates
  ORDER BY module_id
),
mutation AS (
  UPDATE iam.instance_modules AS instance_modules
  SET activation_policy = 'optional', activation_origin = 'policy_reconcile',
    effective_active = false,
    state_revision = instance_modules.state_revision + 1,
    reconcile_id = $3, reconciled_at = now(), updated_at = now(), updated_by = $4
  FROM module_locks
  WHERE instance_modules.instance_id = $1
    AND instance_modules.module_id = module_locks.module_id
    AND module_locks.acquired
    AND (instance_modules.activation_policy IS DISTINCT FROM 'optional'
      OR instance_modules.effective_active
      OR instance_modules.reconcile_id IS DISTINCT FROM $3)
  RETURNING instance_modules.module_id
)
SELECT module_locks.module_id, module_locks.acquired,
  mutation.module_id IS NOT NULL AS changed
FROM module_locks
LEFT JOIN mutation USING (module_id)
ORDER BY module_locks.module_id;
`;
import type { TenantModuleActivationRecord } from '@sva/core';

export type ModuleActivationRow = {
  instance_id: string;
  module_id: string;
  activation_policy: TenantModuleActivationRecord['activationPolicy'];
  activation_origin: TenantModuleActivationRecord['activationOrigin'];
  effective_active: boolean;
  manual_override: TenantModuleActivationRecord['manualOverride'] | null;
  manifest_version: number;
  policy_revision: string;
  state_revision: number | string;
  reconcile_id: string | null;
  reconciled_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};
