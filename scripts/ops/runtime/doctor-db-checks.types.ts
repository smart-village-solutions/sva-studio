import type { SchemaGuardReport } from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { DoctorCheck, TenantRuntimeTargetResolution } from '../runtime-env.shared.ts';

export type LocalTenantSecretState = Readonly<{
  authClientSecretConfigured: boolean;
  authClientSecretReadable: boolean;
  instanceId: string;
  tenantAdminClientConfigured: boolean;
  tenantAdminClientSecretConfigured: boolean;
  tenantAdminClientSecretReadable: boolean;
}>;

export type SchemaSnapshotVerificationReport = Readonly<{
  contentDrift: boolean;
  ignoredSchemas: readonly string[];
  missingObjects: readonly string[];
  status: 'drift' | 'ok';
  unexpectedObjects: readonly string[];
}>;

export type RuntimeDoctorDbCheckDeps = {
  buildLocalInstanceRegistryReconciliationInput: (env: NodeJS.ProcessEnv) => { allowedInstanceIds: readonly string[]; reconcileMode: string } | null;
  collectLocalInstanceIdentityDrift: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => readonly unknown[];
  createDbSqlRunner: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => (sql: string) => string;
  getGooseConfiguredVersion: () => string;
  getRuntimeProfileDefinition: (runtimeProfile: RuntimeProfile) => { isLocal: boolean };
  isMigrationStatusCheckRequired: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => boolean;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => boolean;
  loadActiveLocalTenantSecretStates: (env: NodeJS.ProcessEnv) => Promise<readonly LocalTenantSecretState[]>;
  parseJsonFromCommandOutput: <T>(output: string) => T;
  resolveTenantRuntimeTargets: (
    runtimeProfile: RuntimeProfile,
    env: NodeJS.ProcessEnv,
    options?: { readonly limit?: number },
  ) => Promise<TenantRuntimeTargetResolution>;
  runLocalGooseStatus: (env: NodeJS.ProcessEnv) => { summary: string; version: string };
  sqlIdentifier: (value: string) => string;
  sqlLiteral: (value: string) => string;
  summarizeSchemaGuardFailures: (report: SchemaGuardReport) => string | undefined;
  toDoctorCheck: (
    name: string,
    status: DoctorCheck['status'],
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) => DoctorCheck;
  verifyLocalDbSchemaSnapshot: (env: NodeJS.ProcessEnv) => SchemaSnapshotVerificationReport;
};
