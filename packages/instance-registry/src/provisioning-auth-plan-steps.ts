import type { InstanceRealmMode } from '@sva/core';
import type { KeycloakTenantPlan } from './keycloak-types.js';
import type { KeycloakReadState } from './provisioning-auth-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import {
  isSystemAdminRoleOwnedByInstance,
  readStudioOwnedUser,
  isApprovedTenantAdminAdoption,
} from './provisioning-auth-policy.js';

export const buildRealmStep = (
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

export const buildClientStep = (input: {
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

export const buildTenantAdminClientStep = (input: {
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

export const buildSecretStep = (
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

export const buildTenantAdminClientSecretStep = (
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

export const buildRoleStep = (
  blocked: boolean,
  state: KeycloakReadState | undefined,
  instanceId: string,
  tenantAdminBootstrap?: import('./provisioning-auth-types.js').TenantAdminBootstrap
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

export const buildTenantAdminStep = (
  blocked: boolean,
  state: KeycloakReadState | undefined,
  requireTenantAdmin: boolean,
  instanceId: string,
  tenantAdminBootstrap?: import('./provisioning-auth-types.js').TenantAdminBootstrap
): KeycloakTenantPlan['steps'][number] => {
  const adminStatus = state?.tenantAdminStatus;
  const hasMinimalProfile = hasTenantAdminMinimalProfile(adminStatus);
  const ownershipConflict =
    Boolean(state?.tenantAdminRepresentation) &&
    readStudioOwnedUser(state?.tenantAdminRepresentation, instanceId, 'tenant_admin') !== 'owned' &&
    !isApprovedTenantAdminAdoption(state?.tenantAdminRepresentation, tenantAdminBootstrap);
  const adoption = Boolean(
    state?.tenantAdminRepresentation &&
    !ownershipConflict &&
    readStudioOwnedUser(state.tenantAdminRepresentation, instanceId, 'tenant_admin') !== 'owned'
  );

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
      : adoption
        ? 'update'
        : hasMinimalProfile
          ? 'verify'
          : adminStatus?.tenantAdminExists
            ? 'update'
            : 'create',
    status: blocked ? 'blocked' : 'ready',
    summary: ownershipConflict
      ? 'Der gleichnamige Tenant-Admin ist nicht eindeutig dieser Instanz zugeordnet und wird nicht verändert.'
      : adoption
        ? 'Der bestehende Admin wird nach bestätigtem Identitätsabgleich dieser Instanz zugeordnet.'
        : hasMinimalProfile
          ? 'Der Tenant-Admin entspricht bereits dem Minimalprofil.'
          : 'Der Tenant-Admin wird erstellt oder auf das Minimalprofil korrigiert.',
    details: {
      ...(adminStatus ?? {}),
      ownershipConflict,
      ...(adoption && state?.tenantAdminRepresentation?.id
        ? {
            adoptionBinding: buildPayloadFingerprint({
              userId: state.tenantAdminRepresentation.id,
            }),
          }
        : {}),
    },
  };
};

const hasTenantAdminMinimalProfile = (
  adminStatus: KeycloakReadState['tenantAdminStatus'] | undefined
): boolean => Boolean(adminStatus?.tenantAdminExists && adminStatus.tenantAdminHasSystemAdmin);
