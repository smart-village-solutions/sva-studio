import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { DoctorCheck } from '../runtime-env.shared.ts';
import { shouldUseJobBasedRemoteDbAssertions } from './doctor-db-checks-helpers.ts';
import type { RuntimeDoctorDbCheckDeps } from './doctor-db-checks.types.ts';

const expectedHostnameValues = (deps: RuntimeDoctorDbCheckDeps, expectedHostnames: readonly { hostname: string; instanceId: string }[]) =>
  expectedHostnames
    .map(({ hostname, instanceId }) => `(${deps.sqlLiteral(hostname)}, ${deps.sqlLiteral(instanceId)})`)
    .join(',\n        ');

const buildHostnameMappingSql = (
  deps: RuntimeDoctorDbCheckDeps,
  env: NodeJS.ProcessEnv,
  expectedHostnames: readonly { hostname: string; instanceId: string }[],
) => {
  const appDbUser = env.APP_DB_USER?.trim() || 'sva_app';
  return `
SET ROLE ${deps.sqlIdentifier(appDbUser)};
SELECT json_build_object(
  'missing_hostnames',
  COALESCE(
    (
      SELECT json_agg(expected.hostname ORDER BY expected.hostname)
      FROM (VALUES ${expectedHostnameValues(deps, expectedHostnames)}) AS expected(hostname, instance_id)
      LEFT JOIN (
        SELECT hostname.hostname, instance.id AS instance_id
        FROM iam.instance_hostnames hostname
        JOIN iam.instances instance ON instance.id = hostname.instance_id
        WHERE hostname.is_primary = true
      ) actual ON actual.hostname = expected.hostname AND actual.instance_id = expected.instance_id
      WHERE actual.instance_id IS NULL
    ),
    '[]'::json
  )
)::text;`;
};

const buildInstanceHostnameMappingCheck = async (
  deps: RuntimeDoctorDbCheckDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env, deps)) {
    return deps.toDoctorCheck('instance-hostnames', 'ok', 'instance_hostnames_verified_by_job', 'Tenant-Hostname-Mappings werden fuer Remote-Profile im dedizierten Bootstrap-Job validiert.');
  }
  const tenantTargetResolution = await deps.resolveTenantRuntimeTargets(runtimeProfile, env);
  const expectedHostnames = tenantTargetResolution.targets.map((tenantTarget) => ({ hostname: tenantTarget.host, instanceId: tenantTarget.instanceId }));
  if (expectedHostnames.length === 0) {
    return deps.toDoctorCheck('instance-hostnames', 'skipped', 'instance_hostname_scope_missing', 'Keine Tenant-Host-Pruefung konfiguriert; Registry-Scope oder lokaler Fallback fehlen.', { source: tenantTargetResolution.source });
  }

  try {
    const payload = deps.parseJsonFromCommandOutput<{ missing_hostnames?: string[] }>(
      deps.createDbSqlRunner(runtimeProfile, env)(buildHostnameMappingSql(deps, env, expectedHostnames)),
    );
    const missingHostnames = Array.isArray(payload.missing_hostnames) ? payload.missing_hostnames : [];
    return missingHostnames.length > 0
      ? deps.toDoctorCheck('instance-hostnames', 'error', 'tenant_instance_not_found', 'Mindestens ein erwartetes Tenant-Hostname-Mapping fehlt oder ist nicht primaer.', { missingHostnames, source: tenantTargetResolution.source })
      : deps.toDoctorCheck('instance-hostnames', 'ok', 'tenant_hostnames_ready', 'Alle erwarteten Tenant-Hostname-Mappings sind vorhanden.', { hostnames: expectedHostnames.map(({ hostname }) => hostname), source: tenantTargetResolution.source });
  } catch (error) {
    return deps.toDoctorCheck('instance-hostnames', 'error', 'tenant_host_resolution_failed', error instanceof Error ? error.message : String(error), { hostnames: expectedHostnames.map(({ hostname }) => hostname), source: tenantTargetResolution.source });
  }
};

const buildLocalInstanceIdentityDoctorCheck = (deps: RuntimeDoctorDbCheckDeps, runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): DoctorCheck => {
  if (runtimeProfile !== 'local-keycloak') return deps.toDoctorCheck('instance-identity', 'skipped', 'local_instance_identity_not_applicable', 'Lokale Instanz-Identitaetspruefung ist fuer dieses Runtime-Profil nicht anwendbar.');
  const input = deps.buildLocalInstanceRegistryReconciliationInput(env);
  if (!input) return deps.toDoctorCheck('instance-identity', 'skipped', 'local_instance_identity_scope_missing', 'Lokale Instanz-Identitaetspruefung erfordert SVA_PARENT_DOMAIN und SVA_ALLOWED_INSTANCE_IDS.');

  try {
    const drift = deps.collectLocalInstanceIdentityDrift(runtimeProfile, env);
    return drift.length === 0
      ? deps.toDoctorCheck('instance-identity', 'ok', 'local_instance_identity_ready', 'Die lokale Instanz-Identitaet entspricht dem Zielbild.', { reconcileMode: input.reconcileMode, targetInstanceIds: input.allowedInstanceIds })
      : deps.toDoctorCheck('instance-identity', 'warn', 'local_instance_identity_drift', 'Mindestens eine lokale Instanz driftet in geschuetzten Identitaetsfeldern vom Zielbild ab.', { drift, reconcileMode: input.reconcileMode, targetInstanceIds: input.allowedInstanceIds });
  } catch (error) {
    return deps.toDoctorCheck('instance-identity', 'warn', 'local_instance_identity_check_failed', error instanceof Error ? error.message : String(error));
  }
};

const buildTenantAuthSecretContractCheck = async (
  deps: RuntimeDoctorDbCheckDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  if (!deps.getRuntimeProfileDefinition(runtimeProfile).isLocal || runtimeProfile === 'local-builder') {
    return deps.toDoctorCheck('tenant-auth-secret-contract', 'skipped', 'tenant_auth_secret_not_applicable', 'Tenant-Auth-Secret-Pruefung ist fuer dieses Runtime-Profil nicht anwendbar.');
  }

  try {
    const states = await deps.loadActiveLocalTenantSecretStates(env);
    const unreadableInstanceIds = states
      .filter((state) => state.authClientSecretConfigured && !state.authClientSecretReadable)
      .map((state) => state.instanceId);
    if (unreadableInstanceIds.length > 0) {
      return deps.toDoctorCheck('tenant-auth-secret-contract', 'error', 'tenant_auth_client_secret_unreadable', 'Mindestens ein aktiver Tenant hat ein konfiguriertes, aber lokal nicht lesbares Auth-Secret.', { unreadableInstanceIds });
    }

    const missingInstanceIds = states
      .filter((state) => !state.authClientSecretConfigured)
      .map((state) => state.instanceId);
    return missingInstanceIds.length > 0
      ? deps.toDoctorCheck('tenant-auth-secret-contract', 'error', 'tenant_auth_client_secret_missing', 'Mindestens ein aktiver Tenant hat kein tenant-spezifisches Auth-Secret in der Registry.', { missingInstanceIds })
      : deps.toDoctorCheck('tenant-auth-secret-contract', 'ok', 'tenant_auth_client_secret_ready', 'Alle aktiven Tenants besitzen lesbare tenant-spezifische Auth-Secrets.', { checkedActiveInstanceCount: states.length });
  } catch (error) {
    return deps.toDoctorCheck('tenant-auth-secret-contract', 'error', 'tenant_auth_secret_check_failed', error instanceof Error ? error.message : String(error));
  }
};

const buildTenantAdminSecretContractCheck = async (
  deps: RuntimeDoctorDbCheckDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  if (!deps.getRuntimeProfileDefinition(runtimeProfile).isLocal || runtimeProfile === 'local-builder') {
    return deps.toDoctorCheck('tenant-admin-secret-contract', 'skipped', 'tenant_admin_secret_not_applicable', 'Tenant-Admin-Secret-Pruefung ist fuer dieses Runtime-Profil nicht anwendbar.');
  }

  try {
    const states = await deps.loadActiveLocalTenantSecretStates(env);
    const relevantStates = states.filter((state) => state.tenantAdminClientConfigured);
    const unreadableInstanceIds = relevantStates
      .filter((state) => state.tenantAdminClientSecretConfigured && !state.tenantAdminClientSecretReadable)
      .map((state) => state.instanceId);
    if (unreadableInstanceIds.length > 0) {
      return deps.toDoctorCheck('tenant-admin-secret-contract', 'error', 'tenant_admin_client_secret_unreadable', 'Mindestens ein aktiver Tenant hat ein konfiguriertes, aber lokal nicht lesbares Tenant-Admin-Secret.', { unreadableInstanceIds });
    }

    const missingInstanceIds = relevantStates
      .filter((state) => !state.tenantAdminClientSecretConfigured)
      .map((state) => state.instanceId);
    return missingInstanceIds.length > 0
      ? deps.toDoctorCheck('tenant-admin-secret-contract', 'error', 'tenant_admin_client_secret_missing', 'Mindestens ein aktiver Tenant hat kein tenant-spezifisches Tenant-Admin-Secret in der Registry.', { missingInstanceIds })
      : deps.toDoctorCheck('tenant-admin-secret-contract', 'ok', 'tenant_admin_client_secret_ready', 'Alle aktiven Tenants mit Tenant-Admin-Client besitzen lesbare Tenant-Admin-Secrets.', { checkedActiveInstanceCount: relevantStates.length });
  } catch (error) {
    return deps.toDoctorCheck('tenant-admin-secret-contract', 'error', 'tenant_admin_secret_check_failed', error instanceof Error ? error.message : String(error));
  }
};

export const createDoctorDbTenantChecks = (deps: RuntimeDoctorDbCheckDeps) => ({
  buildInstanceHostnameMappingCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    buildInstanceHostnameMappingCheck(deps, runtimeProfile, env),
  buildLocalInstanceIdentityDoctorCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    buildLocalInstanceIdentityDoctorCheck(deps, runtimeProfile, env),
  buildTenantAdminSecretContractCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    buildTenantAdminSecretContractCheck(deps, runtimeProfile, env),
  buildTenantAuthSecretContractCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    buildTenantAuthSecretContractCheck(deps, runtimeProfile, env),
}) as const;
