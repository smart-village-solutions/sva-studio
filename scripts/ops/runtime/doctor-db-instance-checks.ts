import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { DoctorCheck } from '../runtime-env.shared.ts';
import { queryInvalidActiveInstanceIds, shouldUseJobBasedRemoteDbAssertions } from './doctor-db-checks-helpers.ts';
import type { RuntimeDoctorDbCheckDeps } from './doctor-db-checks.types.ts';

export const createDoctorDbInstanceChecks = (deps: RuntimeDoctorDbCheckDeps) => {
  const buildActorDoctorCheck = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): DoctorCheck => {
    const keycloakSubject = env.SVA_DOCTOR_KEYCLOAK_SUBJECT?.trim();
    const instanceId = env.SVA_DOCTOR_INSTANCE_ID?.trim();
    const sessionRoles = (env.SVA_DOCTOR_SESSION_ROLES ?? '').split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    if (!keycloakSubject || !instanceId) {
      return deps.toDoctorCheck('actor-diagnosis', 'skipped', 'actor_context_missing', 'Kein konkreter Actor-Kontext gesetzt. Fuer tiefe Actor-Diagnose SVA_DOCTOR_KEYCLOAK_SUBJECT und SVA_DOCTOR_INSTANCE_ID explizit setzen.');
    }

    const sql = `
SELECT json_build_object(
  'account_exists', EXISTS(SELECT 1 FROM iam.accounts WHERE keycloak_subject = ${deps.sqlLiteral(keycloakSubject)}),
  'membership_exists', EXISTS(
    SELECT 1 FROM iam.accounts a
    JOIN iam.instance_memberships im ON im.account_id = a.id AND im.instance_id = ${deps.sqlLiteral(instanceId)}
    WHERE a.keycloak_subject = ${deps.sqlLiteral(keycloakSubject)}
  ),
  'persisted_role_keys', COALESCE((
    SELECT json_agg(DISTINCT r.role_key ORDER BY r.role_key)
    FROM iam.accounts a
    JOIN iam.instance_memberships im ON im.account_id = a.id AND im.instance_id = ${deps.sqlLiteral(instanceId)}
    JOIN iam.account_roles ar ON ar.instance_id = im.instance_id AND ar.account_id = im.account_id AND ar.valid_from <= NOW() AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
    JOIN iam.roles r ON r.instance_id = ar.instance_id AND r.id = ar.role_id
    WHERE a.keycloak_subject = ${deps.sqlLiteral(keycloakSubject)}
  ), '[]'::json),
  'persisted_organization_ids', COALESCE((
    SELECT json_agg(DISTINCT ao.organization_id ORDER BY ao.organization_id)
    FROM iam.accounts a
    JOIN iam.instance_memberships im ON im.account_id = a.id AND im.instance_id = ${deps.sqlLiteral(instanceId)}
    JOIN iam.account_organizations ao ON ao.instance_id = im.instance_id AND ao.account_id = im.account_id
    WHERE a.keycloak_subject = ${deps.sqlLiteral(keycloakSubject)}
  ), '[]'::json)
)::text;`;

    try {
      const output = deps.createDbSqlRunner(runtimeProfile, env)(sql);
      const payload = JSON.parse(output.split(/\r?\n/u).filter((entry) => entry.trim().length > 0).slice(-1)[0] ?? '{}') as { account_exists?: boolean; membership_exists?: boolean; persisted_organization_ids?: string[]; persisted_role_keys?: string[] };
      const persistedOrganizationIds = payload.persisted_organization_ids ?? [];
      const persistedRoles = payload.persisted_role_keys ?? [];
      const details = { instanceId, keycloakSubject, persistedOrganizationIds, persistedRoles, sessionRoles };
      const failingCheck = [
        !payload.account_exists ? { code: 'missing_actor_account', details, message: 'Kein IAM-Account fuer den Actor gefunden.' } : null,
        !payload.membership_exists ? { code: 'missing_instance_membership', details, message: 'Der Actor hat keine Instanz-Mitgliedschaft fuer die Zielinstanz.' } : null,
        persistedRoles.length === 0 ? { code: 'missing_actor_role_assignments', details, message: 'Der Actor-Account hat lokal keine persistierten Rollen-Zuweisungen.' } : null,
        persistedOrganizationIds.length === 0 ? { code: 'missing_actor_organization_membership', details, message: 'Der Actor-Account hat lokal keine Organisations-Zuordnungen.' } : null,
      ].find((entry) => entry !== null);
      return failingCheck
        ? deps.toDoctorCheck('actor-diagnosis', 'error', failingCheck.code, failingCheck.message, failingCheck.details)
        : deps.toDoctorCheck('actor-diagnosis', 'ok', 'actor_resolved', 'Actor-Account und Instanz-Mitgliedschaft sind vorhanden.', details);
    } catch (error) {
      return deps.toDoctorCheck('actor-diagnosis', 'error', 'actor_diagnosis_failed', error instanceof Error ? error.message : String(error), { instanceId, keycloakSubject, sessionRoles });
    }
  };

  const buildFeatureFlagCheck = (env: NodeJS.ProcessEnv) => {
    const flags = {
      IAM_UI_ENABLED: env.IAM_UI_ENABLED ?? '',
      IAM_ADMIN_ENABLED: env.IAM_ADMIN_ENABLED ?? '',
      IAM_BULK_ENABLED: env.IAM_BULK_ENABLED ?? '',
      VITE_IAM_UI_ENABLED: env.VITE_IAM_UI_ENABLED ?? '',
      VITE_IAM_ADMIN_ENABLED: env.VITE_IAM_ADMIN_ENABLED ?? '',
      VITE_IAM_BULK_ENABLED: env.VITE_IAM_BULK_ENABLED ?? '',
    };
    return Object.values(flags).some((value) => value.trim().length === 0)
      ? deps.toDoctorCheck('feature-flags', 'warn', 'feature_flags_incomplete', 'Mindestens ein IAM-Feature-Flag ist leer.', { flags })
      : deps.toDoctorCheck('feature-flags', 'ok', 'feature_flags_present', 'IAM-Feature-Flags sind gesetzt.', { flags });
  };

  const buildInstanceAuthConfigCheck = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): DoctorCheck => {
    if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env, deps)) {
      return deps.toDoctorCheck('instance-auth-config', 'ok', 'instance_auth_config_verified_by_job', 'Aktive Instanz-Auth-Konfiguration wird fuer Remote-Profile ueber den dedizierten Bootstrap-Job sichergestellt.', { requiredFields: ['authRealm', 'authClientId'] });
    }
    try {
      const { checkedActiveInstanceCount, invalidInstanceIds } = queryInvalidActiveInstanceIds(runtimeProfile, env, deps, "NULLIF(BTRIM(auth_realm), '') IS NULL OR NULLIF(BTRIM(auth_client_id), '') IS NULL");
      return invalidInstanceIds.length > 0
        ? deps.toDoctorCheck('instance-auth-config', 'error', 'instance_auth_config_missing', 'Mindestens eine aktive Instanz hat keine vollstaendige Auth-Konfiguration.', { checkedActiveInstanceCount, invalidInstanceIds, requiredFields: ['authRealm', 'authClientId'] })
        : deps.toDoctorCheck('instance-auth-config', 'ok', 'instance_auth_config_complete', 'Alle aktiven Instanzen besitzen authRealm und authClientId.', { checkedActiveInstanceCount, requiredFields: ['authRealm', 'authClientId'] });
    } catch (error) {
      return deps.toDoctorCheck('instance-auth-config', 'error', 'instance_auth_config_check_failed', error instanceof Error ? error.message : String(error));
    }
  };

  const buildTenantAdminClientContractCheck = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): DoctorCheck => {
    const cutoverRequired = (env.SVA_REQUIRE_TENANT_ADMIN_CLIENT_CUTOVER ?? 'false').trim().toLowerCase() === 'true';
    if (shouldUseJobBasedRemoteDbAssertions(runtimeProfile, env, deps)) {
      return deps.toDoctorCheck('instance-tenant-admin-contract', 'ok', 'instance_tenant_admin_contract_verified_by_job', 'Tenant-Admin-Client-Vertraege werden fuer Remote-Profile ueber den dedizierten Bootstrap-Job abgesichert.', { cutoverRequired, requiredFields: ['tenantAdminClient.clientId'] });
    }
    try {
      const { checkedActiveInstanceCount, invalidInstanceIds } = queryInvalidActiveInstanceIds(runtimeProfile, env, deps, "NULLIF(BTRIM(tenant_admin_client_id), '') IS NULL");
      if (invalidInstanceIds.length === 0) {
        return deps.toDoctorCheck('instance-tenant-admin-contract', 'ok', 'instance_tenant_admin_contract_complete', 'Alle aktiven Instanzen besitzen einen Tenant-Admin-Client-Vertrag.', { checkedActiveInstanceCount, cutoverRequired, requiredFields: ['tenantAdminClient.clientId'] });
      }
      return deps.toDoctorCheck('instance-tenant-admin-contract', cutoverRequired ? 'error' : 'warn', cutoverRequired ? 'instance_tenant_admin_cutover_blocked' : 'instance_tenant_admin_contract_incomplete', cutoverRequired ? 'Runtime-Cutover ist blockiert: Mindestens eine aktive Instanz hat noch keinen Tenant-Admin-Client.' : 'Mindestens eine aktive Instanz hat noch keinen Tenant-Admin-Client; Login bleibt moeglich, Tenant-Admin-Cutover aber noch nicht.', { checkedActiveInstanceCount, cutoverRequired, invalidInstanceIds, requiredFields: ['tenantAdminClient.clientId'] });
    } catch (error) {
      return deps.toDoctorCheck('instance-tenant-admin-contract', 'error', 'instance_tenant_admin_contract_check_failed', error instanceof Error ? error.message : String(error), { cutoverRequired });
    }
  };

  return { buildActorDoctorCheck, buildFeatureFlagCheck, buildInstanceAuthConfigCheck, buildTenantAdminClientContractCheck } as const;
};
