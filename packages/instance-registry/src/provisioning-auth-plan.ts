import { isInstanceTenantAdminRequired, type InstanceRealmMode } from '@sva/core';

import type { KeycloakTenantPlan, KeycloakTenantPreflight } from './keycloak-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';
import {
  readClientAlignment,
  readTenantAdminClientAlignment,
} from './provisioning-auth-client-alignment.js';
import {
  isSystemAdminRoleOwnedByInstance,
  readStudioOwnedClient,
  readStudioOwnedUser,
} from './provisioning-auth-policy.js';
import { buildPluginOidcClientStep } from './provisioning-auth-plugin-clients.js';
import { buildRealmBaselinePlanSteps } from './keycloak-realm-baseline.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';

export const KEYCLOAK_PLAN_CONTRACT_VERSION = '1.0' as const;

const buildRealmStep = (
  realmMode: InstanceRealmMode,
  state: KeycloakReadState | undefined,
  blocked: boolean
): KeycloakTenantPlan['steps'][number] => {
  const realmExists = Boolean(state?.realm);

  return {
    stepKey: 'realm',
    title: realmMode === 'new' ? 'Realm erstellen' : 'Realm prüfen',
    action: realmMode === 'new' && !realmExists ? 'create' : 'verify',
    status: blocked ? 'blocked' : 'ready',
    summary: resolveRealmSummary(realmMode, realmExists),
    details: { realmExists, realmMode },
  };
};

const resolveRealmSummary = (realmMode: InstanceRealmMode, realmExists: boolean): string => {
  if (realmMode === 'new') {
    return realmExists
      ? 'Der Realm existiert bereits und blockiert den Modus "Neu erstellen".'
      : 'Der Tenant-Realm wird neu angelegt.';
  }

  return realmExists ? 'Der vorhandene Realm wird verwendet.' : 'Der vorhandene Realm fehlt.';
};

const buildClientStep = (input: {
  blocked: boolean;
  clientExists: boolean;
  redirectUrisMatch: boolean;
  logoutUrisMatch: boolean;
  webOriginsMatch: boolean;
  ownershipConflict: boolean;
}): KeycloakTenantPlan['steps'][number] => {
  const fullyAligned = areClientUrisAligned(input);

  return {
    stepKey: 'client',
    title: 'OIDC-Client abgleichen',
    action: input.ownershipConflict
      ? 'skip'
      : !input.clientExists
        ? 'create'
        : fullyAligned
          ? 'verify'
          : 'update',
    status: input.blocked ? 'blocked' : 'ready',
    summary: input.ownershipConflict
      ? 'Der gleichnamige OIDC-Client ist nicht eindeutig dieser Instanz zugeordnet und wird nicht verändert.'
      : !input.clientExists
        ? 'Der OIDC-Client wird angelegt.'
        : fullyAligned
          ? 'Der OIDC-Client entspricht bereits dem Sollzustand.'
          : 'Der OIDC-Client wird auf Root-, Redirect-, Logout- und Origin-Werte abgeglichen.',
    details: {
      clientExists: input.clientExists,
      redirectUrisMatch: input.redirectUrisMatch,
      logoutUrisMatch: input.logoutUrisMatch,
      webOriginsMatch: input.webOriginsMatch,
      ownershipConflict: input.ownershipConflict,
    },
  };
};

const areClientUrisAligned = (input: {
  redirectUrisMatch: boolean;
  logoutUrisMatch: boolean;
  webOriginsMatch: boolean;
}): boolean => input.redirectUrisMatch && input.logoutUrisMatch && input.webOriginsMatch;

const buildTenantAdminClientStep = (input: {
  blocked: boolean;
  clientExists: boolean;
  directAccessGrantsEnabledMatch: boolean;
  rootUrlMatch: boolean;
  redirectUrisMatch: boolean;
  logoutUrisMatch: boolean;
  serviceAccountsEnabledMatch: boolean;
  standardFlowEnabledMatch: boolean;
  webOriginsMatch: boolean;
  ownershipConflict: boolean;
}): KeycloakTenantPlan['steps'][number] => {
  const fullyAligned =
    input.rootUrlMatch &&
    input.redirectUrisMatch &&
    input.logoutUrisMatch &&
    input.webOriginsMatch &&
    input.standardFlowEnabledMatch &&
    input.directAccessGrantsEnabledMatch &&
    input.serviceAccountsEnabledMatch;

  return {
    stepKey: 'tenant_admin_client',
    title: 'Tenant-Admin-Client abgleichen',
    action: input.ownershipConflict
      ? 'skip'
      : !input.clientExists
        ? 'create'
        : fullyAligned
          ? 'verify'
          : 'update',
    status: input.blocked ? 'blocked' : 'ready',
    summary: input.ownershipConflict
      ? 'Der gleichnamige Tenant-Admin-Client ist nicht eindeutig dieser Instanz zugeordnet und wird nicht verändert.'
      : !input.clientExists
        ? 'Der technische Tenant-Admin-Client wird angelegt oder ergänzt.'
        : fullyAligned
          ? 'Der Tenant-Admin-Client entspricht bereits dem Sollzustand.'
          : 'Der Tenant-Admin-Client wird auf Root-, Redirect-, Logout- und Origin-Werte abgeglichen.',
    details: {
      clientExists: input.clientExists,
      directAccessGrantsEnabledMatch: input.directAccessGrantsEnabledMatch,
      rootUrlMatch: input.rootUrlMatch,
      redirectUrisMatch: input.redirectUrisMatch,
      logoutUrisMatch: input.logoutUrisMatch,
      serviceAccountsEnabledMatch: input.serviceAccountsEnabledMatch,
      standardFlowEnabledMatch: input.standardFlowEnabledMatch,
      webOriginsMatch: input.webOriginsMatch,
      ownershipConflict: input.ownershipConflict,
    },
  };
};

const buildSecretStep = (
  blocked: boolean,
  secretAligned: boolean,
  ownershipConflict: boolean
): KeycloakTenantPlan['steps'][number] => ({
  stepKey: 'secret',
  title: 'Tenant-Secret abgleichen',
  action: ownershipConflict || secretAligned ? 'skip' : 'update',
  status: blocked ? 'blocked' : 'ready',
  summary: ownershipConflict
    ? 'Das Secret eines nicht eindeutig zugeordneten Clients wird nicht gelesen oder verändert.'
    : secretAligned
      ? 'Das gespeicherte Tenant-Secret ist bereits mit Keycloak abgeglichen.'
      : 'Das in der Registry gespeicherte Tenant-Secret wird gegen Keycloak abgeglichen.',
  details: { secretAligned, ownershipConflict },
});

const buildTenantAdminClientSecretStep = (
  blocked: boolean,
  tenantAdminClientConfigured: boolean,
  secretAligned: boolean,
  ownershipConflict: boolean
): KeycloakTenantPlan['steps'][number] => ({
  stepKey: 'tenant_admin_client_secret',
  title: 'Tenant-Admin-Client-Secret abgleichen',
  action: ownershipConflict
    ? 'skip'
    : resolveTenantAdminClientSecretAction(tenantAdminClientConfigured, secretAligned),
  status: blocked ? 'blocked' : 'ready',
  summary: ownershipConflict
    ? 'Das Secret eines nicht eindeutig zugeordneten Tenant-Admin-Clients wird nicht gelesen oder verändert.'
    : resolveTenantAdminClientSecretSummary(tenantAdminClientConfigured, secretAligned),
  details: { tenantAdminClientConfigured, secretAligned, ownershipConflict },
});

const resolveTenantAdminClientSecretAction = (
  tenantAdminClientConfigured: boolean,
  secretAligned: boolean
): KeycloakTenantPlan['steps'][number]['action'] => {
  if (!tenantAdminClientConfigured) {
    return 'skip';
  }

  return secretAligned ? 'verify' : 'update';
};

const resolveTenantAdminClientSecretSummary = (
  tenantAdminClientConfigured: boolean,
  secretAligned: boolean
): string => {
  if (!tenantAdminClientConfigured) {
    return 'Ohne Tenant-Admin-Client ist kein separates Admin-Secret zu prüfen.';
  }

  return secretAligned
    ? 'Das Tenant-Admin-Client-Secret ist bereits mit Keycloak abgeglichen.'
    : 'Das Tenant-Admin-Client-Secret wird gegen Keycloak abgeglichen.';
};

const buildRoleStep = (
  blocked: boolean,
  state: KeycloakReadState | undefined,
  instanceId: string
): KeycloakTenantPlan['steps'][number] => {
  const systemAdminRoleExists = isSystemAdminRoleOwnedByInstance(
    state?.systemAdminRole,
    instanceId
  );
  const ownershipConflict = Boolean(state?.systemAdminRole) && !systemAdminRoleExists;
  return {
    stepKey: 'roles',
    title: 'Realm-Rollen sicherstellen',
    action: ownershipConflict ? 'skip' : systemAdminRoleExists ? 'verify' : 'create',
    status: blocked ? 'blocked' : 'ready',
    summary: ownershipConflict
      ? 'Die gleichnamige Realm-Rolle ist nicht eindeutig dieser Instanz zugeordnet und wird nicht verändert.'
      : systemAdminRoleExists
        ? 'Die für das Tenant-Admin-Minimalprofil benötigte Realm-Rolle ist vorhanden.'
        : 'Die für das Tenant-Admin-Minimalprofil benötigte Realm-Rolle wird angelegt.',
    details: { systemAdminRoleExists, ownershipConflict },
  };
};

const buildTenantAdminStep = (
  blocked: boolean,
  state: KeycloakReadState | undefined,
  requireTenantAdmin: boolean,
  instanceId: string
): KeycloakTenantPlan['steps'][number] => {
  const adminStatus = state?.tenantAdminStatus;
  const hasMinimalProfile = hasTenantAdminMinimalProfile(adminStatus);
  const ownershipConflict =
    Boolean(state?.tenantAdminRepresentation) &&
    readStudioOwnedUser(state?.tenantAdminRepresentation, instanceId, 'tenant_admin') !== 'owned';

  if (!requireTenantAdmin) {
    return {
      stepKey: 'tenant_admin',
      title: 'Tenant-Admin sicherstellen',
      action: 'skip',
      status: blocked ? 'blocked' : 'ready',
      summary: 'Für diesen importierten Realm ist kein Bootstrap-Admin konfiguriert.',
      details: adminStatus ?? {},
    };
  }

  return {
    stepKey: 'tenant_admin',
    title: 'Tenant-Admin sicherstellen',
    action: ownershipConflict
      ? 'skip'
      : hasMinimalProfile
        ? 'verify'
        : adminStatus?.tenantAdminExists
          ? 'update'
          : 'create',
    status: blocked ? 'blocked' : 'ready',
    summary: ownershipConflict
      ? 'Der gleichnamige Tenant-Admin ist nicht eindeutig dieser Instanz zugeordnet und wird nicht verändert.'
      : hasMinimalProfile
        ? 'Der Tenant-Admin entspricht bereits dem Minimalprofil.'
        : 'Der Tenant-Admin wird erstellt oder auf das Minimalprofil korrigiert.',
    details: { ...(adminStatus ?? {}), ownershipConflict },
  };
};

const hasTenantAdminMinimalProfile = (
  adminStatus: KeycloakReadState['tenantAdminStatus'] | undefined
): boolean => Boolean(adminStatus?.tenantAdminExists && adminStatus.tenantAdminHasSystemAdmin);

export const buildPlan = (input: {
  instanceId: string;
  realmMode: InstanceRealmMode;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured?: boolean;
  };
  tenantAdminClientSecret?: string;
  tenantAdminBootstrap?: KeycloakProvisioningInput['tenantAdminBootstrap'];
  pluginOidcClients?: KeycloakProvisioningInput['pluginOidcClients'];
  realmBaselineApplicable?: boolean;
  preflight: KeycloakTenantPreflight;
  state?: KeycloakReadState;
}): KeycloakTenantPlan => {
  const blocked = input.preflight.overallStatus === 'blocked';
  const realmBaselineApplicable = input.realmBaselineApplicable ?? input.realmMode === 'new';
  const requireTenantAdmin = isInstanceTenantAdminRequired(input);
  const alignment = readClientAlignment(input.state);
  const tenantAdminClientAlignment = readTenantAdminClientAlignment(input.state);
  const clientOwnershipConflict =
    Boolean(alignment.clientRepresentation) &&
    readStudioOwnedClient(alignment.clientRepresentation, input.instanceId, 'login_client') !==
      'owned';
  const tenantAdminClientOwnershipConflict =
    Boolean(tenantAdminClientAlignment.clientRepresentation) &&
    readStudioOwnedClient(
      tenantAdminClientAlignment.clientRepresentation,
      input.instanceId,
      'tenant_admin_client'
    ) !== 'owned';
  const secretAligned = Boolean(
    input.authClientSecret &&
    input.state?.keycloakClientSecret &&
    input.authClientSecret === input.state.keycloakClientSecret
  );
  const tenantAdminClientSecretAligned = Boolean(
    input.tenantAdminClientSecret &&
    input.state?.tenantAdminClientSecret &&
    input.tenantAdminClientSecret === input.state.tenantAdminClientSecret
  );
  const pluginOidcClients =
    input.pluginOidcClients ??
    input.state?.pluginOidcClients.map(({ requirement }) => requirement) ??
    [];

  const steps: KeycloakTenantPlan['steps'] = [
    buildRealmStep(input.realmMode, input.state, blocked),
    ...buildRealmBaselinePlanSteps(input.state, blocked, realmBaselineApplicable),
    buildClientStep({
      blocked,
      clientExists: Boolean(alignment.clientRepresentation),
      redirectUrisMatch: alignment.redirectUrisMatch,
      logoutUrisMatch: alignment.logoutUrisMatch,
      webOriginsMatch: alignment.webOriginsMatch,
      ownershipConflict: clientOwnershipConflict,
    }),
    buildTenantAdminClientStep({
      blocked,
      clientExists: Boolean(tenantAdminClientAlignment.clientRepresentation),
      directAccessGrantsEnabledMatch: tenantAdminClientAlignment.directAccessGrantsEnabledMatch,
      rootUrlMatch: tenantAdminClientAlignment.rootUrlMatch,
      redirectUrisMatch: tenantAdminClientAlignment.redirectUrisMatch,
      logoutUrisMatch: tenantAdminClientAlignment.logoutUrisMatch,
      serviceAccountsEnabledMatch: tenantAdminClientAlignment.serviceAccountsEnabledMatch,
      standardFlowEnabledMatch: tenantAdminClientAlignment.standardFlowEnabledMatch,
      webOriginsMatch: tenantAdminClientAlignment.webOriginsMatch,
      ownershipConflict: tenantAdminClientOwnershipConflict,
    }),
    ...pluginOidcClients.map((requirement) =>
      buildPluginOidcClientStep(requirement, input.state, blocked, input.instanceId)
    ),
    buildSecretStep(blocked, secretAligned, clientOwnershipConflict),
    buildTenantAdminClientSecretStep(
      blocked,
      Boolean(input.tenantAdminClient?.clientId),
      tenantAdminClientSecretAligned,
      tenantAdminClientOwnershipConflict
    ),
    buildRoleStep(blocked, input.state, input.instanceId),
    buildTenantAdminStep(blocked, input.state, requireTenantAdmin, input.instanceId),
  ];

  const plan: Omit<KeycloakTenantPlan, 'fingerprint' | 'generatedAt'> = {
    contractVersion: KEYCLOAK_PLAN_CONTRACT_VERSION,
    mode: input.realmMode,
    overallStatus: blocked ? 'blocked' : 'ready',
    driftSummary: resolveDriftSummary(blocked, steps),
    steps,
  };
  return {
    ...plan,
    fingerprint: buildPayloadFingerprint({ instanceId: input.instanceId, ...plan }),
    generatedAt: new Date().toISOString(),
  };
};

const resolveDriftSummary = (
  blocked: boolean,
  steps: KeycloakTenantPlan['steps']
): KeycloakTenantPlan['driftSummary'] => {
  if (blocked) {
    return 'Provisioning ist blockiert, bis die Vorbedingungen erfüllt sind.';
  }

  const requiresChanges = steps.some(
    (step: KeycloakTenantPlan['steps'][number]) =>
      step.action !== 'verify' && step.action !== 'skip'
  );
  return requiresChanges
    ? 'Keycloak und Registry weisen Drift auf und werden beim nächsten Lauf abgeglichen.'
    : 'Keycloak entspricht bereits dem im Studio gepflegten Sollzustand.';
};
