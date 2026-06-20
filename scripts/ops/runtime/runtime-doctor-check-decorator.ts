import type { DoctorCheck } from '../runtime-env.shared.ts';

export const createDoctorCheckDecorator = () => {
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

  const decorateDoctorCheck = (check: DoctorCheck): DoctorCheck => {
    const derivedHealthReason = resolveHealthReadyReasonCode(check);
    if (derivedHealthReason) return { ...check, driftClass: 'tenant_secrets', reasonCode: derivedHealthReason, recommendedAction: 'env:repair:local-keycloak', repairable: true };

    switch (check.code) {
      case 'goose_status_failed':
      case 'goose_status_unavailable':
        return { ...check, driftClass: 'schema', reasonCode: 'schema_migration_drift', recommendedAction: 'env:migrate:local-keycloak', repairable: true };
      case 'schema_drift':
      case 'schema_check_failed':
        return { ...check, driftClass: 'schema', reasonCode: 'schema_manual_drift', recommendedAction: 'env:migrate:local-keycloak', repairable: false };
      case 'local_keycloak_provisioning_worker_missing':
      case 'local_keycloak_provisioning_worker_stale':
        return { ...check, driftClass: 'worker', reasonCode: 'worker_unavailable', recommendedAction: 'env:up:local-keycloak', repairable: false };
      case 'missing_actor_account':
      case 'missing_instance_membership':
      case 'missing_actor_role_assignments':
      case 'missing_actor_organization_membership':
      case 'actor_diagnosis_failed':
        return { ...check, driftClass: 'actor_binding', reasonCode: 'actor_binding_drift', recommendedAction: 'env:bind:local-user', repairable: false };
      case 'local_instance_identity_drift':
        return { ...check, driftClass: 'instance_identity', reasonCode: 'instance_identity_drift', recommendedAction: 'env:reconcile:local-instance-registry', repairable: true };
      case 'tenant_auth_client_secret_missing':
      case 'tenant_auth_client_secret_unreadable':
      case 'tenant_admin_client_secret_missing':
      case 'tenant_admin_client_secret_unreadable':
        return { ...check, driftClass: 'tenant_secrets', reasonCode: check.code, recommendedAction: 'env:repair:local-keycloak', repairable: true };
      case 'schema_snapshot_drift':
        return { ...check, driftClass: 'schema_snapshot', reasonCode: 'schema_snapshot_drift', recommendedAction: 'env:verify:db-schema-snapshot', repairable: false };
      default:
        return check;
    }
  };

  return { decorateDoctorCheck } as const;
};
