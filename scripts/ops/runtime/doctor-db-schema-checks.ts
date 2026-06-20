import {
  CRITICAL_IAM_SCHEMA_GUARD_FIELDS,
  CRITICAL_IAM_SCHEMA_GUARD_SQL,
  evaluateCriticalIamSchemaGuard,
  type SchemaGuardReport,
} from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { DoctorCheck } from '../runtime-env.shared.ts';
import { recoverSchemaGuardReportFromOutput, shouldUseJobBasedRemoteDbAssertions } from './doctor-db-checks-helpers.ts';
import type { RuntimeDoctorDbCheckDeps } from './doctor-db-checks.types.ts';

const runSchemaGuard = (deps: RuntimeDoctorDbCheckDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): SchemaGuardReport => {
  if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env, deps)) return { ok: true, checks: [] };
  const output = deps.createDbSqlRunner(runtimeProfile, env)(`${CRITICAL_IAM_SCHEMA_GUARD_SQL}`);
  const fieldCount = CRITICAL_IAM_SCHEMA_GUARD_FIELDS.length;
  const boolMatrixPattern = new RegExp(`(?:t|f)(?:\\|(?:t|f)){${fieldCount - 1}}`, 'gu');
  const line = Array.from(output.matchAll(boolMatrixPattern)).map((match) => match[0]).at(-1);
  if (!line) throw new Error(`Schema-Guard-Ausgabe konnte nicht als Bool-Matrix gelesen werden: ${output}`);
  const row = Object.fromEntries(line.split('|').map((value, index) => [CRITICAL_IAM_SCHEMA_GUARD_FIELDS[index], value]));
  return evaluateCriticalIamSchemaGuard(row);
};

const schemaGuardDoctorCheck = (deps: RuntimeDoctorDbCheckDeps, report: SchemaGuardReport, details: Readonly<Record<string, unknown>> = {}) =>
  report.ok
    ? deps.toDoctorCheck('schema-guard', 'ok', 'schema_ok', 'Kritische IAM-Schema-Artefakte sind vorhanden.', { checks: report.checks, ...details })
    : deps.toDoctorCheck('schema-guard', 'error', 'schema_drift', deps.summarizeSchemaGuardFailures(report) ?? 'Kritische IAM-Schema-Artefakte fehlen oder weichen ab.', { checks: report.checks, ...details });

const buildSchemaGuardCheck = (deps: RuntimeDoctorDbCheckDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): DoctorCheck => {
  if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env, deps)) {
    return deps.toDoctorCheck('schema-guard', 'ok', 'schema_guard_verified_by_job', 'Kritische IAM-Schema-Pruefungen werden fuer Remote-Profile im dedizierten Bootstrap-Job ausgefuehrt.');
  }
  try {
    return schemaGuardDoctorCheck(deps, runSchemaGuard(deps, runtimeProfile, env));
  } catch (error) {
    const recovered = recoverSchemaGuardReportFromOutput(error instanceof Error ? error.message : String(error));
    return recovered
      ? schemaGuardDoctorCheck(deps, recovered, { recoveredFromTransportNoise: true })
      : deps.toDoctorCheck('schema-guard', 'error', 'schema_check_failed', error instanceof Error ? error.message : String(error));
  }
};

const buildMigrationStatusCheck = (deps: RuntimeDoctorDbCheckDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): DoctorCheck => {
  const migrationStatusRequired = deps.isMigrationStatusCheckRequired(runtimeProfile, env);
  try {
    if (deps.isRemoteRuntimeProfile(runtimeProfile)) {
      return deps.toDoctorCheck('migration-status', migrationStatusRequired ? 'warn' : 'skipped', 'remote_goose_status_disabled', 'Remote-Goose-Status wird nicht mehr ueber quantum-cli exec abgefragt; Schema-Guard und Job-Exit-Codes sind autoritativ.');
    }
    const result = deps.runLocalGooseStatus(env);
    return deps.toDoctorCheck('migration-status', 'ok', 'goose_status_ok', 'Goose-Migrationsstatus konnte abgefragt werden.', { gooseVersion: result.version, summary: result.summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!migrationStatusRequired) return deps.toDoctorCheck('migration-status', 'skipped', 'migration_status_optional', 'Remote-Goose-Status ist fuer dieses Runtime-Profil optional und blockiert die fruehe Studio-Testphase nicht.', { gooseVersion: deps.getGooseConfiguredVersion(), reason: message });
    return deps.toDoctorCheck('migration-status', deps.isRemoteRuntimeProfile(runtimeProfile) ? 'warn' : 'error', deps.isRemoteRuntimeProfile(runtimeProfile) ? 'goose_status_unavailable' : 'goose_status_failed', message, { gooseVersion: deps.getGooseConfiguredVersion() });
  }
};

const buildSchemaSnapshotCheck = (deps: RuntimeDoctorDbCheckDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): DoctorCheck => {
  if (!deps.getRuntimeProfileDefinition(runtimeProfile).isLocal || runtimeProfile === 'local-builder') {
    return deps.toDoctorCheck('schema-snapshot', 'skipped', 'schema_snapshot_not_applicable', 'Schema-Snapshot-Abgleich ist fuer dieses Runtime-Profil nicht anwendbar.');
  }
  try {
    const report = deps.verifyLocalDbSchemaSnapshot(env);
    return report.status === 'ok'
      ? deps.toDoctorCheck('schema-snapshot', 'ok', 'schema_snapshot_ok', 'Der DB-Schema-Snapshot entspricht dem migrationsbasierten lokalen Datenbankstand.', { ignoredSchemas: report.ignoredSchemas })
      : deps.toDoctorCheck('schema-snapshot', 'warn', 'schema_snapshot_drift', 'Der eingecheckte DB-Schema-Snapshot driftet vom aktuellen lokalen Datenbankstand ab.', { ignoredSchemas: report.ignoredSchemas, missingObjects: report.missingObjects, unexpectedObjects: report.unexpectedObjects });
  } catch (error) {
    return deps.toDoctorCheck('schema-snapshot', 'warn', 'schema_snapshot_check_failed', error instanceof Error ? error.message : String(error));
  }
};

export const createDoctorDbSchemaChecks = (deps: RuntimeDoctorDbCheckDeps) => ({
  buildMigrationStatusCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => buildMigrationStatusCheck(deps, runtimeProfile, env),
  buildSchemaGuardCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => buildSchemaGuardCheck(deps, runtimeProfile, env),
  buildSchemaSnapshotCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => buildSchemaSnapshotCheck(deps, runtimeProfile, env),
  runSchemaGuard: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => runSchemaGuard(deps, runtimeProfile, env),
}) as const;
