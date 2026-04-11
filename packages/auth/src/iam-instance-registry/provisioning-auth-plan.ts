import type { InstanceRealmMode } from '@sva/core';

import type { KeycloakTenantPlan, KeycloakTenantPreflight } from './keycloak-types.js';
import type { KeycloakReadState } from './provisioning-auth-types.js';
import { equalSets, INSTANCE_ID_MAPPER_NAME, readPostLogoutUris } from './provisioning-auth-utils.js';

const buildRealmStep = (
  realmMode: InstanceRealmMode,
  state: KeycloakReadState | undefined,
  blocked: boolean
): KeycloakTenantPlan['steps'][number] => ({
  stepKey: 'realm',
  title: realmMode === 'new' ? 'Realm erstellen' : 'Realm prüfen',
  action: realmMode === 'new' && !state?.realm ? 'create' : 'verify',
  status: blocked ? 'blocked' : 'ready',
  summary:
    realmMode === 'new'
      ? state?.realm
        ? 'Der Realm existiert bereits und blockiert den Modus "Neu erstellen".'
        : 'Der Tenant-Realm wird neu angelegt.'
      : state?.realm
        ? 'Der vorhandene Realm wird verwendet.'
        : 'Der vorhandene Realm fehlt.',
  details: { realmExists: Boolean(state?.realm), realmMode },
});

const readClientAlignment = (state: KeycloakReadState | undefined) => {
  const expectedClient = state?.expectedClient;
  const clientRepresentation = state?.clientRepresentation;
  return {
    clientRepresentation,
    mapperExists: Boolean(state?.protocolMappers.some((mapper) => mapper.name === INSTANCE_ID_MAPPER_NAME)),
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

const buildClientStep = (input: {
  blocked: boolean;
  clientExists: boolean;
  redirectUrisMatch: boolean;
  logoutUrisMatch: boolean;
  webOriginsMatch: boolean;
}): KeycloakTenantPlan['steps'][number] => ({
  stepKey: 'client',
  title: 'OIDC-Client abgleichen',
  action: !input.clientExists
    ? 'create'
    : input.redirectUrisMatch && input.logoutUrisMatch && input.webOriginsMatch
      ? 'verify'
      : 'update',
  status: input.blocked ? 'blocked' : 'ready',
  summary: !input.clientExists
    ? 'Der OIDC-Client wird angelegt.'
    : input.redirectUrisMatch && input.logoutUrisMatch && input.webOriginsMatch
      ? 'Der OIDC-Client entspricht bereits dem Sollzustand.'
      : 'Der OIDC-Client wird auf Root-, Redirect-, Logout- und Origin-Werte abgeglichen.',
  details: {
    clientExists: input.clientExists,
    redirectUrisMatch: input.redirectUrisMatch,
    logoutUrisMatch: input.logoutUrisMatch,
    webOriginsMatch: input.webOriginsMatch,
  },
});

const buildMapperStep = (blocked: boolean, mapperExists: boolean): KeycloakTenantPlan['steps'][number] => ({
  stepKey: 'mapper',
  title: 'instanceId-Mapper sicherstellen',
  action: mapperExists ? 'verify' : 'create',
  status: blocked ? 'blocked' : 'ready',
  summary: mapperExists
    ? 'Der instanceId-Mapper ist bereits vorhanden.'
    : 'Der instanceId-Mapper wird angelegt oder korrigiert.',
  details: { mapperExists },
});

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
  const hasMinimalProfile = Boolean(
    adminStatus?.tenantAdminExists &&
      adminStatus.tenantAdminHasSystemAdmin &&
      !adminStatus.tenantAdminHasInstanceRegistryAdmin &&
      adminStatus.tenantAdminInstanceIdMatches
  );

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

export const buildPlan = (input: {
  realmMode: InstanceRealmMode;
  authClientSecret?: string;
  preflight: KeycloakTenantPreflight;
  state?: KeycloakReadState;
}): KeycloakTenantPlan => {
  const blocked = input.preflight.overallStatus === 'blocked';
  const alignment = readClientAlignment(input.state);
  const secretAligned = Boolean(
    input.authClientSecret &&
      input.state?.keycloakClientSecret &&
      input.authClientSecret === input.state.keycloakClientSecret
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
    buildMapperStep(blocked, alignment.mapperExists),
    buildSecretStep(blocked, secretAligned),
    buildRoleStep(blocked, input.state),
    buildTenantAdminStep(blocked, input.state),
  ];

  return {
    mode: input.realmMode,
    overallStatus: blocked ? 'blocked' : 'ready',
    generatedAt: new Date().toISOString(),
    driftSummary: blocked
      ? 'Provisioning ist blockiert, bis die Vorbedingungen erfüllt sind.'
      : steps.some((step) => step.action !== 'verify' && step.action !== 'skip')
        ? 'Keycloak und Registry weisen Drift auf und werden beim nächsten Lauf abgeglichen.'
        : 'Keycloak entspricht bereits dem im Studio gepflegten Sollzustand.',
    steps,
  };
};
