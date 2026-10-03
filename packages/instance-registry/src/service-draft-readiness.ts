import { buildPrimaryHostname } from '@sva/core';
import type { IamInstanceDraftReadiness } from '@sva/core';
import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import type { KeycloakTenantPlan, KeycloakTenantPreflight } from './keycloak-types.js';
import {
  buildPlan,
  buildPreflightChecks,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';
import type { KeycloakReadState } from './provisioning-auth-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import {
  buildBackgroundProvisioningCapabilities,
  buildDraftFingerprint,
  buildNormalizedDraft,
  createDependencyFailure,
  toProvisioningInput,
} from './service-draft-readiness-projection.js';

export { buildBackgroundProvisioningCapabilities } from './service-draft-readiness-projection.js';
export {
  isAssignedPluginLifecycleReady,
  collectActivationReadinessBlockers,
} from './service-active-provisioning.js';
export type RealmSuitability = Readonly<{
  classification: 'ready' | 'auto_completable' | 'manual_resolution_required';
  reasonCode: string;
  impact: 'create' | 'provisioning' | 'activation';
  remediation: string;
  responsibility: 'studio_admin' | 'platform_operator';
  nextCheck: 'draft_readiness';
  plan: KeycloakTenantPlan;
}>;

export type InstanceDraftReadiness = IamInstanceDraftReadiness;

const readSafeAccessCode = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; statusCode?: unknown; name?: unknown };
    if (candidate.statusCode === 401) return 'keycloak_authentication_failed';
    if (candidate.statusCode === 403) return 'keycloak_authorization_failed';
    if (candidate.name === 'AbortError' || candidate.name === 'TimeoutError') {
      return 'keycloak_timeout';
    }
    if (candidate.name === 'KeycloakAdminUnavailableError') {
      return 'keycloak_unavailable';
    }
    if (candidate.code === 'keycloak_unavailable' || candidate.code === 'keycloak_circuit_open') {
      return candidate.code;
    }
  }
  return 'keycloak_readiness_unavailable';
};

export const buildRealmSuitability = (input: {
  plan: KeycloakTenantPlan;
  createBlockers: readonly KeycloakTenantPreflight['checks'][number][];
}): RealmSuitability => {
  const ownershipConflict = input.createBlockers.some(
    (check) => check.checkKey === 'realm_ownership'
  );
  const otherCreateBlocker = input.createBlockers[0];
  if (ownershipConflict || otherCreateBlocker) {
    return {
      classification: 'manual_resolution_required',
      reasonCode: ownershipConflict ? 'artifact_ownership_conflict' : 'realm_readiness_blocked',
      impact: 'create',
      remediation: ownershipConflict
        ? 'Fremde oder unmarkierte Artefakte außerhalb des automatischen Flows klären; anschließend den Entwurf erneut prüfen.'
        : 'Den ausgewiesenen Anlageblocker beheben und den Entwurf erneut prüfen.',
      responsibility: ownershipConflict ? 'platform_operator' : 'studio_admin',
      nextCheck: 'draft_readiness',
      plan: input.plan,
    };
  }
  const requiresChanges = input.plan.steps.some(
    (step) => step.action === 'create' || step.action === 'update'
  );
  return {
    classification: requiresChanges ? 'auto_completable' : 'ready',
    reasonCode: requiresChanges ? 'studio_artifacts_missing_or_drifted' : 'studio_artifacts_ready',
    impact: requiresChanges ? 'provisioning' : 'activation',
    remediation: requiresChanges
      ? 'Den angezeigten Plan ausdrücklich bestätigen und anschließend ausführen.'
      : 'Keine Realm-Nacharbeit erforderlich; die übrigen Aktivierungsvoraussetzungen prüfen.',
    responsibility: 'studio_admin',
    nextCheck: 'draft_readiness',
    plan: input.plan,
  };
};

/** Read-only readiness for data which has not entered the registry yet. */
export const createDraftReadinessHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (input: CreateInstanceProvisioningInput): Promise<InstanceDraftReadiness> => {
    if (!deps.readKeycloakStateViaProvisioner) return createDependencyFailure(deps, input);
    const provisioningInput = toProvisioningInput(input, deps);
    const primaryHostname = buildPrimaryHostname(input.instanceId, input.parentDomain);
    const [instanceIdCollision, hostnameCollision] = await Promise.all([
      deps.repository.getInstanceById(input.instanceId),
      deps.repository.resolvePrimaryHostname(primaryHostname),
    ]);
    let state: KeycloakReadState | undefined;
    let accessError: string | undefined;
    try {
      state = await deps.readKeycloakStateViaProvisioner(provisioningInput);
    } catch (error) {
      accessError = readSafeAccessCode(error);
    }
    const initialChecks = buildPreflightChecks({
      instanceId: input.instanceId,
      realmMode: input.realmMode,
      authClientSecretConfigured: provisioningInput.authClientSecretConfigured,
      authClientSecret: provisioningInput.authClientSecret,
      tenantAdminClient: provisioningInput.tenantAdminClient,
      tenantAdminClientSecret: provisioningInput.tenantAdminClientSecret,
      tenantAdminBootstrap: provisioningInput.tenantAdminBootstrap,
      state,
      accessError,
    });
    const preflight: KeycloakTenantPreflight = {
      overallStatus: toOverallPreflightStatus(initialChecks),
      checkedAt: new Date().toISOString(),
      checks: initialChecks,
    };

    // A missing imported-realm secret is remediated by the explicit provisioning
    // action. It must not turn a successful registry create into a false blocker.
    const checks = preflight.checks.map((check) =>
      input.realmMode === 'existing' &&
      check.checkKey === 'tenant_secret' &&
      check.status === 'blocked'
        ? { ...check, status: 'warning' as const }
        : check
    );
    if (instanceIdCollision) {
      checks.push({
        checkKey: 'registry_instance_id',
        title: 'Instanz-ID',
        status: 'blocked',
        summary: 'Die Instanz-ID ist bereits in der Registry vergeben.',
        details: {
          reasonCode: 'instance_id_already_exists',
          conflictingInstanceId: instanceIdCollision.instanceId,
        },
      });
    }
    if (hostnameCollision) {
      checks.push({
        checkKey: 'registry_hostname',
        title: 'Primärer Hostname',
        status: 'blocked',
        summary: 'Der primäre Hostname ist bereits einer Registry-Instanz zugeordnet.',
        details: {
          reasonCode: 'primary_hostname_already_exists',
          conflictingInstanceId: hostnameCollision.instanceId,
          primaryHostname,
        },
      });
    }
    if (input.realmMode === 'new') {
      let capable: boolean;
      try {
        capable = (await deps.readKeycloakRealmCreateCapability?.()) === true;
      } catch {
        capable = false;
      }
      checks.push({
        checkKey: 'realm_create_capability',
        title: 'Berechtigung zur Realm-Anlage',
        status: capable ? 'ready' : 'blocked',
        summary: capable
          ? 'Die technische Provisioner-Identität besitzt die erforderliche Keycloak-Berechtigung zur Realm-Anlage.'
          : 'Die technische Provisioner-Identität kann die Berechtigung zur Realm-Anlage nicht nachweisen.',
        details: {
          reasonCode: capable
            ? 'realm_create_capability_verified'
            : 'realm_create_capability_missing',
        },
      });
    }
    if (input.realmMode === 'existing') {
      const assigned = (await deps.repository.listInstances()).find(
        (instance) =>
          instance.authRealm === input.authRealm && instance.instanceId !== input.instanceId
      );
      if (input.authRealm === 'master' || assigned) {
        checks.push({
          checkKey: 'realm_selection',
          title: 'Realm-Auswahl',
          status: 'blocked',
          summary:
            input.authRealm === 'master'
              ? 'Der Keycloak-System-Realm master kann keiner Studio-Instanz zugeordnet werden.'
              : 'Der Realm ist bereits einer anderen Studio-Instanz zugeordnet.',
          details:
            input.authRealm === 'master'
              ? { reasonCode: 'system_realm' }
              : { reasonCode: 'already_assigned', assignedInstanceId: assigned?.instanceId },
        });
      }
    }
    const normalizedPreflight: KeycloakTenantPreflight = {
      ...preflight,
      overallStatus: checks.some((check) => check.status === 'blocked')
        ? 'blocked'
        : checks.some((check) => check.status === 'warning')
          ? 'warning'
          : 'ready',
      checks,
    };
    const createBlockers = checks.filter(
      (check) =>
        check.status === 'blocked' &&
        [
          'keycloak_admin_access',
          'registry_instance_id',
          'registry_hostname',
          'realm_mode',
          'realm_selection',
          'realm_ownership',
          'realm_create_capability',
          'tenant_admin_profile',
        ].includes(check.checkKey)
    );
    const provisioningBlockers = checks.filter(
      (check) => check.status !== 'ready' && !createBlockers.includes(check)
    );
    const plan = buildPlan({
      instanceId: input.instanceId,
      realmMode: input.realmMode,
      authClientSecret: provisioningInput.authClientSecret,
      tenantAdminClient: provisioningInput.tenantAdminClient,
      tenantAdminClientSecret: provisioningInput.tenantAdminClientSecret,
      tenantAdminBootstrap: provisioningInput.tenantAdminBootstrap,
      pluginOidcClients: provisioningInput.pluginOidcClients,
      preflight: normalizedPreflight,
      state,
    });
    return {
      checkedAt: normalizedPreflight.checkedAt,
      contractVersion: '1.0',
      draftFingerprint: buildDraftFingerprint(input),
      normalizedDraft: buildNormalizedDraft(input),
      createBlockers,
      provisioningBlockers,
      activationBlockers: provisioningBlockers,
      backgroundCapabilities: buildBackgroundProvisioningCapabilities(
        deps,
        input,
        'draft_readiness'
      ),
      preflight: normalizedPreflight,
      ...(input.realmMode === 'existing'
        ? { realmSuitability: buildRealmSuitability({ plan, createBlockers }) }
        : {}),
    };
  };
