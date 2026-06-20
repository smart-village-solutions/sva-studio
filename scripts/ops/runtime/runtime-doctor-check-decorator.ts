import type { DoctorCheck, DoctorReasonCode } from '../runtime-env.shared.ts';

type DecoratedDoctorCheckFields = Pick<DoctorCheck, 'driftClass' | 'reasonCode' | 'recommendedAction' | 'repairable'>;

const schemaMigrationDecoration = {
  driftClass: 'schema',
  reasonCode: 'schema_migration_drift',
  recommendedAction: 'env:migrate:local-keycloak',
  repairable: true,
} as const;

const manualSchemaDecoration = {
  driftClass: 'schema',
  reasonCode: 'schema_manual_drift',
  recommendedAction: 'env:migrate:local-keycloak',
  repairable: false,
} as const;

const tenantSecretDecoration = (reasonCode: DoctorReasonCode) => ({
  driftClass: 'tenant_secrets',
  reasonCode,
  recommendedAction: 'env:repair:local-keycloak',
  repairable: true,
}) as const;

const staticDecorations: Readonly<Record<string, DecoratedDoctorCheckFields>> = {
  actor_diagnosis_failed: { driftClass: 'actor_binding', reasonCode: 'actor_binding_drift', recommendedAction: 'env:bind:local-user', repairable: false },
  goose_status_failed: schemaMigrationDecoration,
  goose_status_unavailable: schemaMigrationDecoration,
  local_instance_identity_drift: { driftClass: 'instance_identity', reasonCode: 'instance_identity_drift', recommendedAction: 'env:reconcile:local-instance-registry', repairable: true },
  local_keycloak_provisioning_worker_missing: { driftClass: 'worker', reasonCode: 'worker_unavailable', recommendedAction: 'env:up:local-keycloak', repairable: false },
  local_keycloak_provisioning_worker_stale: { driftClass: 'worker', reasonCode: 'worker_unavailable', recommendedAction: 'env:up:local-keycloak', repairable: false },
  missing_actor_account: { driftClass: 'actor_binding', reasonCode: 'actor_binding_drift', recommendedAction: 'env:bind:local-user', repairable: false },
  missing_actor_organization_membership: { driftClass: 'actor_binding', reasonCode: 'actor_binding_drift', recommendedAction: 'env:bind:local-user', repairable: false },
  missing_actor_role_assignments: { driftClass: 'actor_binding', reasonCode: 'actor_binding_drift', recommendedAction: 'env:bind:local-user', repairable: false },
  missing_instance_membership: { driftClass: 'actor_binding', reasonCode: 'actor_binding_drift', recommendedAction: 'env:bind:local-user', repairable: false },
  schema_check_failed: manualSchemaDecoration,
  schema_drift: manualSchemaDecoration,
  schema_snapshot_drift: { driftClass: 'schema_snapshot', reasonCode: 'schema_snapshot_drift', recommendedAction: 'env:verify:db-schema-snapshot', repairable: false },
};

const tenantSecretCodes = new Set<DoctorReasonCode>([
  'tenant_admin_client_secret_missing',
  'tenant_admin_client_secret_unreadable',
  'tenant_auth_client_secret_missing',
  'tenant_auth_client_secret_unreadable',
]);

const isTenantSecretReasonCode = (code: string): code is DoctorReasonCode =>
  tenantSecretCodes.has(code as DoctorReasonCode);

const resolveHealthReadyReasonCode = (check: DoctorCheck) => {
  if (check.name !== 'health-ready') return undefined;
  const payload = check.details?.payload;
  if (!payload || typeof payload !== 'object') return undefined;
  const checks = (payload as Record<string, unknown>).checks;
  if (!checks || typeof checks !== 'object') return undefined;
  const diagnostics = (checks as Record<string, unknown>).diagnostics;
  const auth = diagnostics && typeof diagnostics === 'object' ? (diagnostics as Record<string, unknown>).auth : undefined;
  const rawReasonCode = auth && typeof auth === 'object' ? (auth as Record<string, unknown>).reason_code : undefined;
  return rawReasonCode === 'tenant_auth_client_secret_missing' || rawReasonCode === 'tenant_auth_client_secret_unreadable'
    ? rawReasonCode
    : undefined;
};

const resolveDecoration = (check: DoctorCheck): DecoratedDoctorCheckFields | undefined => {
  const derivedHealthReason = resolveHealthReadyReasonCode(check);
  if (derivedHealthReason) return tenantSecretDecoration(derivedHealthReason);
  if (isTenantSecretReasonCode(check.code)) return tenantSecretDecoration(check.code);
  return staticDecorations[check.code];
};

const decorateDoctorCheck = (check: DoctorCheck): DoctorCheck => {
  const decoration = resolveDecoration(check);
  return decoration ? { ...check, ...decoration } : check;
};

export const createDoctorCheckDecorator = () => ({ decorateDoctorCheck }) as const;
