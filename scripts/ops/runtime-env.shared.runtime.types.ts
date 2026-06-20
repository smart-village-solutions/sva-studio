import type { RuntimeProfile } from '../../packages/core/src/runtime-profile.ts';

export type RemoteRuntimeProfile = Exclude<RuntimeProfile, 'local-builder' | 'local-keycloak'>;
export type RuntimeCommand =
  | 'deploy'
  | 'doctor'
  | 'down'
  | 'migrate'
  | 'precheck'
  | 'repair'
  | 'reconcile'
  | 'reset'
  | 'smoke'
  | 'status'
  | 'up'
  | 'update'
  | 'verify-schema-snapshot';

export type DoctorCheckStatus = 'error' | 'ok' | 'skipped' | 'warn';
export type DoctorReasonCode =
  | 'actor_binding_drift'
  | 'instance_identity_drift'
  | 'schema_manual_drift'
  | 'schema_migration_drift'
  | 'schema_snapshot_drift'
  | 'tenant_admin_client_secret_missing'
  | 'tenant_admin_client_secret_unreadable'
  | 'tenant_auth_client_secret_missing'
  | 'tenant_auth_client_secret_unreadable'
  | 'worker_unavailable';
export type DoctorRecommendedAction =
  | 'env:bind:local-user'
  | 'env:doctor:local-keycloak'
  | 'env:migrate:local-keycloak'
  | 'env:up:local-keycloak'
  | 'env:reconcile:local-instance-registry'
  | 'env:repair:local-keycloak'
  | 'env:verify:db-schema-snapshot'
  | 'manual_investigation';
export type RuntimeDriftClass = 'actor_binding' | 'instance_identity' | 'schema' | 'schema_snapshot' | 'tenant_secrets' | 'worker';

export type DoctorCheck = {
  code: string;
  details?: Readonly<Record<string, unknown>>;
  driftClass?: RuntimeDriftClass;
  message: string;
  name: string;
  reasonCode?: DoctorReasonCode;
  recommendedAction?: DoctorRecommendedAction;
  repairable?: boolean;
  status: DoctorCheckStatus;
};

export type DoctorReport = {
  checks: readonly DoctorCheck[];
  generatedAt: string;
  profile: RuntimeProfile;
  status: 'error' | 'ok' | 'warn';
};

export type TenantRuntimeTarget = Readonly<{
  authRealm: string;
  host: string;
  instanceId: string;
}>;

export type TenantRuntimeTargetResolution = Readonly<{
  source: 'explicit_env' | 'legacy_allowlist_fallback' | 'local_allowlist' | 'none' | 'registry';
  targets: readonly TenantRuntimeTarget[];
}>;
