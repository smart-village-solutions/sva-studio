import { buildPrimaryHostname } from '@sva/core';
import type { IamInstanceDraftReadiness, IamInstanceProvisioningCapability } from '@sva/core';

import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import type { KeycloakTenantPlan, KeycloakTenantPreflight } from './keycloak-types.js';
import { buildKeycloakSnapshotInputFingerprint } from './provisioning-auth-policy.js';
import {
  buildPlan,
  buildPreflightChecks,
  toOverallPreflightStatus,
} from './provisioning-auth-evaluation.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

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

const buildNormalizedDraft = (input: CreateInstanceProvisioningInput) => ({
  instanceId: input.instanceId,
  primaryHostname: buildPrimaryHostname(input.instanceId, input.parentDomain),
  realmMode: input.realmMode,
  authRealm: input.authRealm,
  authClientId: input.authClientId,
  authClientSecretConfigured: Boolean(input.authClientSecret),
});

const buildDraftFingerprint = (input: CreateInstanceProvisioningInput): string =>
  buildKeycloakSnapshotInputFingerprint({
    ...buildNormalizedDraft(input),
    authIssuerUrl: input.authIssuerUrl,
    tenantAdminClient: input.tenantAdminClient && {
      clientId: input.tenantAdminClient.clientId,
      secretConfigured: Boolean(input.tenantAdminClient.secret),
    },
    tenantAdminBootstrap: input.tenantAdminBootstrap,
  });

export const buildBackgroundProvisioningCapabilities = (
  deps: InstanceRegistryServiceDeps,
  input: Pick<CreateInstanceProvisioningInput, 'instanceId' | 'parentDomain'>,
  nextCheck: IamInstanceProvisioningCapability['nextCheck']
): readonly IamInstanceProvisioningCapability[] => {
  const automatedIngress =
    deps.isAutomatedTenantProvisioningEnabled?.({
      parentDomain: input.parentDomain,
    }) === true;
  const capability = (
    value: Omit<IamInstanceProvisioningCapability, 'nextCheck'>
  ): IamInstanceProvisioningCapability => ({ ...value, nextCheck });

  return [
    capability({
      capability: 'worker',
      status: 'unknown',
      reasonCode: 'worker_heartbeat_unavailable',
      summary: 'Für den Background-Worker liegt in diesem Readback kein aktueller Heartbeat vor.',
      impact: 'provisioning',
      remediation: 'Workerzustand und ausstehende Aufträge im Betriebsmonitoring prüfen.',
      responsibility: 'platform_operator',
    }),
    capability({
      capability: 'queue',
      status: 'ready',
      reasonCode: 'durable_queue_available',
      summary:
        'Der dauerhafte Provisioning-Auftrag kann in der Instanz-Registry gespeichert werden.',
      impact: 'provisioning',
      remediation: 'Keine Aktion erforderlich.',
      responsibility: 'platform_operator',
    }),
    capability({
      capability: 'callback',
      status: 'unknown',
      reasonCode: 'callback_readiness_unavailable',
      summary: 'Die Post-Commit-Aufweckung besitzt keinen synchronen Verfügbarkeitsnachweis.',
      impact: 'provisioning',
      remediation:
        'Bei ausbleibender Verarbeitung den dauerhaften Auftrag über den Recovery-Pfad prüfen.',
      responsibility: 'platform_operator',
    }),
    capability({
      capability: 'provisioner',
      status: deps.provisionInstanceAuth ? 'ready' : 'unknown',
      reasonCode: deps.provisionInstanceAuth
        ? 'provisioner_adapter_available'
        : 'provisioner_worker_readiness_unavailable',
      summary: deps.provisionInstanceAuth
        ? 'Der Provisioning-Adapter ist in diesem Ausführungskontext verfügbar.'
        : 'Der read-only API-Kontext kann den Provisioning-Adapter des Workers nicht nachweisen.',
      impact: 'provisioning',
      remediation: deps.provisionInstanceAuth
        ? 'Keine Aktion erforderlich.'
        : 'Worker-Konfiguration und Provisioner-Verbindung prüfen.',
      responsibility: 'platform_operator',
    }),
    capability({
      capability: 'ingress',
      status: automatedIngress
        ? deps.publishTenantIngress && deps.probeTenantEndpoint
          ? 'ready'
          : 'unknown'
        : 'not_required',
      reasonCode: automatedIngress
        ? deps.publishTenantIngress && deps.probeTenantEndpoint
          ? 'ingress_automation_available'
          : 'ingress_worker_readiness_unavailable'
        : 'ingress_automation_not_required',
      summary: automatedIngress
        ? deps.publishTenantIngress && deps.probeTenantEndpoint
          ? 'Ingress-Publikation und Probe sind im Worker-Kontext verfügbar.'
          : 'Das Profil benötigt automatisiertes Ingress, dessen Worker-Fähigkeit hier nicht nachweisbar ist.'
        : 'Für dieses Profil ist keine automatisierte Ingress-Bereitstellung erforderlich.',
      impact: 'activation',
      remediation:
        automatedIngress && !(deps.publishTenantIngress && deps.probeTenantEndpoint)
          ? 'Ingress-Worker und Probe für dieses Profil prüfen.'
          : 'Keine Aktion erforderlich.',
      responsibility: 'platform_operator',
    }),
    capability({
      capability: 'plugin',
      status: deps.pluginTenantLifecycleRegistry ? 'ready' : 'unknown',
      reasonCode: deps.pluginTenantLifecycleRegistry
        ? 'plugin_lifecycle_registry_available'
        : 'plugin_lifecycle_registry_unavailable',
      summary: deps.pluginTenantLifecycleRegistry
        ? 'Die registrierten Plugin-Lifecycles können ausgewertet werden.'
        : 'Plugin-Lifecycle-Fähigkeiten sind in diesem Kontext nicht nachweisbar.',
      impact: 'activation',
      remediation: deps.pluginTenantLifecycleRegistry
        ? 'Keine Aktion erforderlich.'
        : 'Plugin-Lifecycle-Registry und Worker-Konfiguration prüfen.',
      responsibility: 'platform_operator',
    }),
  ];
};

const createDependencyFailure = (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput
): InstanceDraftReadiness => {
  const checkedAt = new Date().toISOString();
  const finding = {
    checkKey: 'keycloak_admin_access',
    title: 'Technischer Keycloak-Zugriff',
    status: 'blocked' as const,
    summary: 'Die Keycloak-Readiness kann derzeit nicht serverseitig geprüft werden.',
    details: { errorCode: 'keycloak_readiness_unavailable' },
  };
  return {
    checkedAt,
    contractVersion: '1.0',
    draftFingerprint: buildDraftFingerprint(input),
    normalizedDraft: buildNormalizedDraft(input),
    createBlockers: [finding],
    provisioningBlockers: [],
    activationBlockers: [],
    backgroundCapabilities: buildBackgroundProvisioningCapabilities(deps, input, 'draft_readiness'),
    preflight: { overallStatus: 'blocked', checkedAt, checks: [finding] },
  };
};

const toProvisioningInput = (
  input: CreateInstanceProvisioningInput,
  deps: InstanceRegistryServiceDeps
): KeycloakProvisioningInput => ({
  instanceId: input.instanceId,
  primaryHostname: buildPrimaryHostname(input.instanceId, input.parentDomain),
  realmMode: input.realmMode,
  authRealm: input.authRealm,
  authClientId: input.authClientId,
  authIssuerUrl: input.authIssuerUrl,
  authClientSecretConfigured: Boolean(input.authClientSecret),
  authClientSecret: input.authClientSecret,
  tenantAdminClient: input.tenantAdminClient && {
    clientId: input.tenantAdminClient.clientId,
    secretConfigured: Boolean(input.tenantAdminClient.secret),
  },
  tenantAdminClientSecret: input.tenantAdminClient?.secret,
  tenantAdminBootstrap: input.tenantAdminBootstrap,
  pluginOidcClients: deps.readPluginOidcClientRequirements?.(),
});

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

const buildRealmSuitability = (input: {
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
