import {
  targets,
  resolveDatabaseTarget,
  postgresIdentifierPattern,
  deriveWasteDatabaseName,
} from './runtime-config.mjs';
import { validTenantInstanceId } from './request-validation.mjs';

export const sqlIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

export const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

const isConfiguredRuntimePrincipalTarget = (target) =>
  Object.keys(targets)
    .flatMap((environment) => [
      resolveDatabaseTarget(environment, 'studio'),
      resolveDatabaseTarget(environment, 'ssf'),
    ])
    .some(
      (candidate) =>
        candidate.postgresDatabase === target.postgresDatabase &&
        candidate.postgresHost === target.postgresHost &&
        candidate.runtimeRole === target.runtimeRole &&
        candidate.runtimeUser === target.runtimeUser &&
        candidate.schemaOwner === target.schemaOwner
    );

const isWasteRuntimePrincipalTarget = (target) =>
  target.database === 'waste' &&
  validTenantInstanceId(target.tenantInstanceId) &&
  postgresIdentifierPattern.test(target.sourceDatabase) &&
  target.sourceDatabase === deriveWasteDatabaseName(target.tenantInstanceId) &&
  [target.sourceDatabase, `${target.sourceDatabase}_restore`].includes(target.postgresDatabase) &&
  target.schemaOwner === `${target.sourceDatabase.slice(0, -3)}_owner` &&
  target.runtimeRole === `${target.sourceDatabase.slice(0, -3)}_app` &&
  target.runtimeUser === target.runtimeRole &&
  target.publicRuntimeUser === `${target.sourceDatabase.slice(0, -3)}_public`;

export const assertRuntimePrincipalTarget = (target) => {
  const configuredTarget = isConfiguredRuntimePrincipalTarget(target);
  const dynamicWasteTarget = isWasteRuntimePrincipalTarget(target);
  if (!configuredTarget && !dynamicWasteTarget) throw new Error('runtime_principal_target_invalid');
};

export const buildRuntimePrincipalReconciliationSql = (target) => {
  assertRuntimePrincipalTarget(target);
  if (target.database === 'waste') return buildWasteRuntimePrincipalReconciliationSql(target);
  if (target.database === 'ssf') return buildSsfRuntimePrincipalReconciliationSql(target);
  const database = sqlIdentifier(target.postgresDatabase);
  const runtimeRole = sqlIdentifier(target.runtimeRole);
  const runtimeUser = sqlIdentifier(target.runtimeUser);
  const schemaOwner = sqlIdentifier(target.schemaOwner);
  return `
DO $restore_principal_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.schemaOwner)})
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.runtimeRole)})
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.runtimeUser)}) THEN
    RAISE EXCEPTION 'restore_runtime_principal_missing';
  END IF;
END
$restore_principal_guard$;

SET ROLE ${schemaOwner};
GRANT ${runtimeRole} TO ${runtimeUser};
GRANT CONNECT ON DATABASE ${database} TO ${runtimeUser};
GRANT USAGE ON SCHEMA iam TO ${runtimeRole}, ${runtimeUser};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO ${runtimeRole}, ${runtimeUser};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO ${runtimeRole}, ${runtimeUser};
ALTER DEFAULT PRIVILEGES FOR ROLE ${schemaOwner} IN SCHEMA iam
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${runtimeRole}, ${runtimeUser};
ALTER DEFAULT PRIVILEGES FOR ROLE ${schemaOwner} IN SCHEMA iam
  GRANT USAGE, SELECT ON SEQUENCES TO ${runtimeRole}, ${runtimeUser};
RESET ROLE;
`;
};

export const buildSsfRuntimePrincipalReconciliationSql = (target) => {
  assertRuntimePrincipalTarget(target);
  if (target.database !== 'ssf') throw new Error('runtime_principal_target_invalid');
  const database = sqlIdentifier(target.postgresDatabase);
  const runtimeRole = sqlIdentifier(target.runtimeRole);
  const runtimeUser = sqlIdentifier(target.runtimeUser);
  const schemaOwner = sqlIdentifier(target.schemaOwner);
  return `
DO $restore_principal_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.runtimeRole)})
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.runtimeUser)}) THEN
    RAISE EXCEPTION 'restore_runtime_principal_missing';
  END IF;
END
$restore_principal_guard$;

SET ROLE ${schemaOwner};
GRANT ${runtimeRole} TO ${runtimeUser} WITH INHERIT FALSE;
GRANT CONNECT ON DATABASE ${database} TO ${runtimeUser};
GRANT USAGE ON SCHEMA ssf TO ${runtimeRole};
GRANT SELECT ON ssf.server_settings, ssf.server_locales TO ${runtimeRole};
GRANT SELECT, INSERT, UPDATE, DELETE ON ssf.tenant_settings, ssf.tenant_locales TO ${runtimeRole};
GRANT SELECT (
  instance_id, generation, status, desired_revision, confirmed_revision,
  sessions_revoked_revision, last_error_code
) ON ssf.authorization_projections TO ${runtimeRole};

DO $restore_subject_evidence_grant$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'ssf'
       AND table_name = 'authorization_projections'
       AND column_name = 'confirmed_has_subjects'
  ) THEN
    GRANT SELECT (confirmed_has_subjects)
      ON ssf.authorization_projections TO ${runtimeRole};
  END IF;
END
$restore_subject_evidence_grant$;
RESET ROLE;
`;
};

export const buildWasteRuntimePrincipalReconciliationSql = (target) => {
  assertRuntimePrincipalTarget(target);
  if (target.database !== 'waste') throw new Error('runtime_principal_target_invalid');
  const database = sqlIdentifier(target.postgresDatabase);
  const owner = sqlIdentifier(target.schemaOwner);
  const app = sqlIdentifier(target.runtimeUser);
  const publicApp = sqlIdentifier(target.publicRuntimeUser);
  return `
DO $restore_principal_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.schemaOwner)})
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.runtimeUser)})
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(target.publicRuntimeUser)}) THEN
    RAISE EXCEPTION 'restore_runtime_principal_missing';
  END IF;
END
$restore_principal_guard$;

SET ROLE ${owner};
GRANT CONNECT ON DATABASE ${database} TO ${app}, ${publicApp};
GRANT USAGE ON SCHEMA public TO ${app}, ${publicApp};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${app};
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${app};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${app};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${publicApp};
GRANT INSERT, UPDATE, DELETE ON TABLE
  public.waste_email_reminder_subscriptions,
  public.waste_email_reminder_subscription_items,
  public.waste_email_reminder_outbox
TO ${publicApp};
RESET ROLE;
`;
};
