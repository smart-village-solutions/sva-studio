import {
  CRITICAL_IAM_SCHEMA_GUARD_FIELDS,
  evaluateCriticalIamSchemaGuard,
  type SchemaGuardReport,
} from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { RuntimeDoctorDbCheckDeps } from './doctor-db-checks.types.ts';

export const shouldUseJobBasedRemoteDbAssertions = (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  deps: RuntimeDoctorDbCheckDeps,
) =>
  deps.isRemoteRuntimeProfile(runtimeProfile) &&
  (env.SVA_REMOTE_DB_ASSERTIONS_MODE?.trim().toLowerCase() ?? 'job') === 'job';

export const recoverSchemaGuardReportFromOutput = (value: string): SchemaGuardReport | null => {
  const fieldCount = CRITICAL_IAM_SCHEMA_GUARD_FIELDS.length;
  const boolMatrixPattern = new RegExp(`(?:t|f)(?:\\|(?:t|f)){${fieldCount - 1}}`, 'gu');
  const matches = Array.from(value.matchAll(boolMatrixPattern)).map((match) => match[0]);
  const line = matches.at(-1);
  if (!line) return null;
  const row = Object.fromEntries(line.split('|').map((entry, index) => [CRITICAL_IAM_SCHEMA_GUARD_FIELDS[index], entry]));
  return evaluateCriticalIamSchemaGuard(row);
};

export const queryInvalidActiveInstanceIds = (
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  deps: RuntimeDoctorDbCheckDeps,
  invalidConditionSql: string,
) => {
  const appDbUser = env.APP_DB_USER?.trim() || 'sva_app';
  const sql = `
SET ROLE ${deps.sqlIdentifier(appDbUser)};

SELECT json_build_object(
  'invalid_instance_ids',
  COALESCE(
    (
      SELECT json_agg(instance_id ORDER BY instance_id)
      FROM (
        SELECT id AS instance_id
        FROM iam.instances
        WHERE status = 'active'
          AND (${invalidConditionSql})
      ) invalid_instances
    ),
    '[]'::json
  ),
  'checked_active_instance_count',
  (
    SELECT COUNT(*)
    FROM iam.instances
    WHERE status = 'active'
  )
)::text;
`;
  const payload = deps.parseJsonFromCommandOutput<{ checked_active_instance_count?: number; invalid_instance_ids?: string[] }>(
    deps.createDbSqlRunner(runtimeProfile, env)(sql),
  );

  return {
    checkedActiveInstanceCount: typeof payload.checked_active_instance_count === 'number' ? payload.checked_active_instance_count : 0,
    invalidInstanceIds: Array.isArray(payload.invalid_instance_ids) ? payload.invalid_instance_ids : [],
  };
};
