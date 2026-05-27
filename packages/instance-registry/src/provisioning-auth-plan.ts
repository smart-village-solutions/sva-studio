import type { InstanceRealmMode } from '@sva/core';

import type { KeycloakTenantPlan, KeycloakTenantPreflight } from './keycloak-types.js';
import type { KeycloakReadState } from './provisioning-auth-types.js';
import { equalSets, readPostLogoutUris } from './provisioning-auth-utils.js';

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

const readClientAlignment = (state: KeycloakReadState | undefined) => {
  const expectedClient = state?.expectedClient;
  const clientRepresentation = state?.clientRepresentation;
  return {
    clientRepresentation,
    redirectUrisMatch: expectedClient
      ? equalSets(clientRepresentation?.redirectUris ?? [], expectedClient.redirectUris)
      : false,
    logoutUrisMatch: expectedClient
      ? equalSets(readPostLogoutUris(clientRepresentation?.attributes), expectedClient.postLogoutRedirectUris)
      : false,
    webOriginsMatch: expectedClient
      ? equalSets(clientRepresentation?.webOrigins ?? [], expectedClient.webOrigins)
      : false,
  };
};

const readTenantAdminClientAlignment = (state: KeycloakReadState | undefined) => {
  const expectedClient = state?.expectedTenantAdminClient;
  const clientRepresentation = state?.tenantAdminClientRepresentation;
  return {
    clientRepresentation,
    directAccessGrantsEnabledMatch: expectedClient
      ? clientRepresentation?.directAccessGrantsEnabled === expectedClient.directAccessGrantsEnabled
      : false,
    rootUrlMatch: expectedClient ? clientRepresentation?.rootUrl === expectedClient.rootUrl : false,
    redirectUrisMatch: expectedClient
      ? equalSets(clientRepresentation?.redirectUris ?? [], expectedClient.redirectUris)
      : false,
    serviceAccountsEnabledMatch: expectedClient
      ? clientRepresentation?.serviceAccountsEnabled === expectedClient.serviceAccountsEnabled
      : false,
    standardFlowEnabledMatch: expectedClient
      ? clientRepresentation?.standardFlowEnabled === expectedClient.standardFlowEnabled
      : false,
    logoutUrisMatch: expectedClient
      ? equalSets(readPostLogoutUris(clientRepresentation?.attributes), expectedClient.postLogoutRedirectUris)
      : false,
    webOriginsMatch: expectedClient
      ? equalSets(clientRepresentation?.webOrigins ?? [], expectedClient.webOrigins)
      : false,
  };
};

const buildClientStep = (input: {
  blocked: boolean;
  clientExists: boolean;
  redirectUrisMatch: boolean;
  logoutUrisMatch: boolean;
  webOriginsMatch: boolean;
}): KeycloakTenantPlan['steps'][number] => {
  const fullyAligned = areClientUrisAligned(input);

  return {
    stepKey: 'client',
    title: 'OIDC-Client abgleichen',
    action: !input.clientExists ? 'create' : fullyAligned ? 'verify' : 'update',
    status: input.blocked ? 'blocked' : 'ready',
    summary: !input.clientExists
      ? 'Der OIDC-Client wird angelegt.'
      : fullyAligned
        ? 'Der OIDC-Client entspricht bereits dem Sollzustand.'
        : 'Der OIDC-Client wird auf Root-, Redirect-, Logout- und Origin-Werte abgeglichen.',
    details: {
      clientExists: input.clientExists,
      redirectUrisMatch: input.redirectUrisMatch,
      logoutUrisMatch: input.logoutUrisMatch,
      webOriginsMatch: input.webOriginsMatch,
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
}): KeycloakTenantPlan['steps'][number] => {
  const fullyAligned =
    input.rootUrlMatch
    && input.redirectUrisMatch
    && input.logoutUrisMatch
    && input.webOriginsMatch
    && input.standardFlowEnabledMatch
    && input.directAccessGrantsEnabledMatch
    && input.serviceAccountsEnabledMatch;

  return {
    stepKey: 'tenant_admin_client',
    title: 'Tenant-Admin-Client abgleichen',
    action: !input.clientExists ? 'create' : fullyAligned ? 'verify' : 'update',
    status: input.blocked ? 'blocked' : 'ready',
    summary: !input.clientExists
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
    },
  };
};

const buildSecretStep = (blocked: boolean, secretAligned: boolean): KeycloakTenantPlan['steps'][number] => ({
  stepKey: 'secret',
  title: 'Tenant-Secret abgleichen',
  action: secretAligned ? 'skip' : 'update',
  status: blocked ? 'blocked' : 'ready',
  summary: secretAligned
    ? 'Das gespeicherte Tenant-Secret ist bereits mit Keycloak abgeglichen.'
    : 'Das in der Registry gespeicherte Tenant-Secret wird gegen Keycloak abgeglichen.',
  details: { secretAligned },
});

const buildTenantAdminClientSecretStep = (
  blocked: boolean,
  tenantAdminClientConfigured: boolean,
  secretAligned: boolean
): KeycloakTenantPlan['steps'][number] => ({
  stepKey: 'tenant_admin_client_secret',
  title: 'Tenant-Admin-Client-Secret abgleichen',
  action: resolveTenantAdminClientSecretAction(tenantAdminClientConfigured, secretAligned),
  status: blocked ? 'blocked' : 'ready',
  summary: resolveTenantAdminClientSecretSummary(tenantAdminClientConfigured, secretAligned),
  details: { tenantAdminClientConfigured, secretAligned },
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
  state: KeycloakReadState | undefined
): KeycloakTenantPlan['steps'][number] => ({
  stepKey: 'roles',
  title: 'Realm-Rollen sicherstellen',
  action: state?.systemAdminRole && state?.instanceRegistryAdminRole ? 'verify' : 'create',
  status: blocked ? 'blocked' : 'ready',
  summary:
    state?.systemAdminRole && state?.instanceRegistryAdminRole
      ? 'Die benötigten Realm-Rollen sind vorhanden.'
      : 'Die benötigten Realm-Rollen werden angelegt.',
  details: {
    systemAdminRoleExists: Boolean(state?.systemAdminRole),
    instanceRegistryAdminRoleExists: Boolean(state?.instanceRegistryAdminRole),
  },
});

const buildTenantAdminStep = (
  blocked: boolean,
  state: KeycloakReadState | undefined
): KeycloakTenantPlan['steps'][number] => {
  const adminStatus = state?.tenantAdminStatus;
  const hasMinimalProfile = hasTenantAdminMinimalProfile(adminStatus);

  return {
    stepKey: 'tenant_admin',
    title: 'Tenant-Admin sicherstellen',
    action: hasMinimalProfile ? 'verify' : adminStatus?.tenantAdminExists ? 'update' : 'create',
    status: blocked ? 'blocked' : 'ready',
    summary: hasMinimalProfile
      ? 'Der Tenant-Admin entspricht bereits dem Minimalprofil.'
      : 'Der Tenant-Admin wird erstellt oder auf das Minimalprofil korrigiert.',
    details: adminStatus ?? {},
  };
};

const hasTenantAdminMinimalProfile = (
  adminStatus: KeycloakReadState['tenantAdminStatus'] | undefined
): boolean =>
  Boolean(
    adminStatus?.tenantAdminExists &&
      adminStatus.tenantAdminHasSystemAdmin &&
      !adminStatus.tenantAdminHasInstanceRegistryAdmin
  );

export const buildPlan = (input: {
  realmMode: InstanceRealmMode;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured?: boolean;
  };
  tenantAdminClientSecret?: string;
  preflight: KeycloakTenantPreflight;
  state?: KeycloakReadState;
}): KeycloakTenantPlan => {
  const blocked = input.preflight.overallStatus === 'blocked';
  const alignment = readClientAlignment(input.state);
  const tenantAdminClientAlignment = readTenantAdminClientAlignment(input.state);
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

  const steps: KeycloakTenantPlan['steps'] = [
    buildRealmStep(input.realmMode, input.state, blocked),
    buildClientStep({
      blocked,
      clientExists: Boolean(alignment.clientRepresentation),
      redirectUrisMatch: alignment.redirectUrisMatch,
      logoutUrisMatch: alignment.logoutUrisMatch,
      webOriginsMatch: alignment.webOriginsMatch,
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
    }),
    buildSecretStep(blocked, secretAligned),
    buildTenantAdminClientSecretStep(
      blocked,
      Boolean(input.tenantAdminClient?.clientId),
      tenantAdminClientSecretAligned
    ),
    buildRoleStep(blocked, input.state),
    buildTenantAdminStep(blocked, input.state),
  ];

  return {
    mode: input.realmMode,
    overallStatus: blocked ? 'blocked' : 'ready',
    generatedAt: new Date().toISOString(),
    driftSummary: resolveDriftSummary(blocked, steps),
    steps,
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
    (step: KeycloakTenantPlan['steps'][number]) => step.action !== 'verify' && step.action !== 'skip'
  );
  return requiresChanges
    ? 'Keycloak und Registry weisen Drift auf und werden beim nächsten Lauf abgeglichen.'
    : 'Keycloak entspricht bereits dem im Studio gepflegten Sollzustand.';
};
