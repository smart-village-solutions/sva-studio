import { buildPrimaryHostname } from '@sva/core';
import type { IamInstanceDraftReadiness, IamInstanceProvisioningCapability } from '@sva/core';
import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import { buildKeycloakSnapshotInputFingerprint } from './provisioning-auth-policy.js';
import type { KeycloakProvisioningInput } from './provisioning-auth-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

export const buildNormalizedDraft = (input: CreateInstanceProvisioningInput) => ({
  instanceId: input.instanceId,
  primaryHostname: buildPrimaryHostname(input.instanceId, input.parentDomain),
  realmMode: input.realmMode,
  authRealm: input.authRealm,
  authClientId: input.authClientId,
  authClientSecretConfigured: Boolean(input.authClientSecret),
});

export const buildDraftFingerprint = (input: CreateInstanceProvisioningInput): string =>
  buildKeycloakSnapshotInputFingerprint({
    ...buildNormalizedDraft(input),
    authIssuerUrl: input.authIssuerUrl,
    tenantAdminClient: input.tenantAdminClient && {
      clientId: input.tenantAdminClient.clientId,
      secretConfigured: Boolean(input.tenantAdminClient.secret),
    },
    tenantAdminBootstrap: input.tenantAdminBootstrap,
  });

const buildIngressCapability = (
  deps: InstanceRegistryServiceDeps,
  automatedIngress: boolean
): Omit<IamInstanceProvisioningCapability, 'nextCheck'> => {
  return {
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
  };
};

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
    capability(buildIngressCapability(deps, automatedIngress)),
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

export const createDependencyFailure = (
  deps: InstanceRegistryServiceDeps,
  input: CreateInstanceProvisioningInput
): IamInstanceDraftReadiness => {
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

export const toProvisioningInput = (
  input: CreateInstanceProvisioningInput,
  deps: InstanceRegistryServiceDeps
): KeycloakProvisioningInput => {
  const requestedModuleIds = new Set(input.moduleIds ?? []);
  return {
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
    pluginOidcClients: (deps.readPluginOidcClientRequirements?.() ?? []).filter(({ pluginId }) =>
      requestedModuleIds.has(pluginId)
    ),
  };
};
