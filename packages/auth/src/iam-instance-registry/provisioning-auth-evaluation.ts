import type { InstanceKeycloakPreflightCheck, InstanceRealmMode } from '@sva/core';
import type { KeycloakTenantPreflight, KeycloakTenantStatus } from './keycloak-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState, TenantAdminBootstrap } from './provisioning-auth-types.js';
import { equalSets, INSTANCE_ID_MAPPER_NAME, readPostLogoutUris } from './provisioning-auth-utils.js';
export { buildPlan } from './provisioning-auth-plan.js';

export const buildMissingRealmStatus = (
  authClientSecretConfigured: boolean,
  authClientSecret?: string
): KeycloakTenantStatus => ({
  realmExists: false,
  clientExists: false,
  instanceIdMapperExists: false,
  tenantAdminExists: false,
  tenantAdminHasSystemAdmin: false,
  tenantAdminHasInstanceRegistryAdmin: false,
  tenantAdminInstanceIdMatches: false,
  redirectUrisMatch: false,
  logoutUrisMatch: false,
  webOriginsMatch: false,
  clientSecretConfigured: authClientSecretConfigured,
  tenantClientSecretReadable: Boolean(authClientSecret),
  clientSecretAligned: false,
  runtimeSecretSource: authClientSecret ? 'tenant' : 'global',
});

const isTenantSecretRequired = (realmMode: InstanceRealmMode): boolean => realmMode === 'existing';

const createPreflightCheck = (
  checkKey: string,
  title: string,
  status: InstanceKeycloakPreflightCheck['status'],
  summary: string,
  details: Readonly<Record<string, unknown>> = {}
): InstanceKeycloakPreflightCheck => ({
  checkKey,
  title,
  status,
  summary,
  details,
});

const buildRealmModeCheck = (input: {
  realmMode: InstanceRealmMode;
  realmExists: boolean;
}): InstanceKeycloakPreflightCheck => {
  const status: InstanceKeycloakPreflightCheck['status'] =
    input.realmMode === 'new'
      ? input.realmExists
        ? 'blocked'
        : 'ready'
      : input.realmExists
        ? 'ready'
        : 'blocked';

  const summary =
    input.realmMode === 'new'
      ? input.realmExists
        ? 'Der Realm existiert bereits, obwohl "Neuer Realm" gewählt wurde.'
        : 'Der Ziel-Realm fehlt und kann neu angelegt werden.'
      : input.realmExists
        ? 'Der bestehende Realm ist erreichbar.'
        : 'Der gewählte Bestands-Realm wurde nicht gefunden.';

  return createPreflightCheck('realm_mode', 'Realm-Modus', status, summary, {
    realmExists: input.realmExists,
    realmMode: input.realmMode,
  });
};

const buildTenantSecretCheck = (input: {
  realmMode: InstanceRealmMode;
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
}): InstanceKeycloakPreflightCheck => {
  const hasReadableSecret = Boolean(input.authClientSecret);
  const requiresTenantSecret = isTenantSecretRequired(input.realmMode);
  const status: InstanceKeycloakPreflightCheck['status'] =
    input.authClientSecretConfigured && hasReadableSecret
      ? 'ready'
      : requiresTenantSecret
        ? 'blocked'
        : 'warning';

  const summary =
    input.authClientSecretConfigured && hasReadableSecret
      ? 'Ein lesbares Tenant-Client-Secret ist in der Registry vorhanden.'
      : requiresTenantSecret
        ? 'Für diese Instanz fehlt ein lesbares Tenant-Client-Secret in der Registry.'
        : 'Das Tenant-Client-Secret wird beim Erstellen des neuen Realm automatisch erzeugt und anschließend gespeichert.';

  return createPreflightCheck('tenant_secret', 'Tenant-Client-Secret', status, summary, {
    configured: input.authClientSecretConfigured,
    readable: hasReadableSecret,
    generatedDuringProvisioning: input.realmMode === 'new',
  });
};

const buildTenantAdminCheck = (tenantAdminBootstrap?: TenantAdminBootstrap): InstanceKeycloakPreflightCheck => {
  const configured = Boolean(tenantAdminBootstrap?.username);
  return createPreflightCheck(
    'tenant_admin_profile',
    'Tenant-Admin-Profil',
    configured ? 'ready' : 'blocked',
    configured
      ? 'Die Stammdaten für den Tenant-Admin sind gepflegt.'
      : 'Für den Tenant-Admin fehlen die erforderlichen Stammdaten.',
    { configured }
  );
};

export const buildPreflightChecks = (input: {
  realmMode: InstanceRealmMode;
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
  state?: KeycloakReadState;
  accessError?: string;
}): readonly InstanceKeycloakPreflightCheck[] => {
  const checks: InstanceKeycloakPreflightCheck[] = [
    createPreflightCheck('platform_access', 'Plattformzugriff', 'ready', 'Der aufrufende Benutzer ist für die Root-Host-Instanzverwaltung autorisiert.'),
  ];

  if (input.accessError) {
    checks.push(
      createPreflightCheck(
        'keycloak_admin_access',
        'Technischer Keycloak-Zugriff',
        'blocked',
        'Der technische Keycloak-Admin-Client konnte den Ziel-Realm nicht lesen.',
        { error: input.accessError }
      )
    );
    return checks;
  }

  const realmExists = Boolean(input.state?.realm);
  checks.push(
    createPreflightCheck(
      'keycloak_admin_access',
      'Technischer Keycloak-Zugriff',
      'ready',
      'Der technische Keycloak-Admin-Client kann den Ziel-Realm lesen.'
    ),
    buildRealmModeCheck({ realmMode: input.realmMode, realmExists }),
    buildTenantSecretCheck({
      realmMode: input.realmMode,
      authClientSecretConfigured: input.authClientSecretConfigured,
      authClientSecret: input.authClientSecret,
    }),
    buildTenantAdminCheck(input.tenantAdminBootstrap)
  );

  return checks;
};

export const toOverallPreflightStatus = (
  checks: readonly InstanceKeycloakPreflightCheck[]
): KeycloakTenantPreflight['overallStatus'] => {
  if (checks.some((check) => check.status === 'blocked')) {
    return 'blocked';
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }
  return 'ready';
};

export const buildKeycloakStatus = (
  input: Pick<KeycloakProvisioningInput, 'authClientSecretConfigured' | 'authClientSecret' | 'instanceId' | 'authRealm' | 'authClientId' | 'realmMode'> & {
    state: KeycloakReadState;
  }
): KeycloakTenantStatus => {
  const clientSecretAligned = Boolean(
    input.authClientSecret && input.state.keycloakClientSecret && input.authClientSecret === input.state.keycloakClientSecret
  );

  return {
    realmExists: true,
    clientExists: Boolean(input.state.clientRepresentation),
    instanceIdMapperExists: input.state.protocolMappers.some((mapper) => mapper.name === INSTANCE_ID_MAPPER_NAME),
    ...input.state.tenantAdminStatus,
    redirectUrisMatch: equalSets(input.state.clientRepresentation?.redirectUris ?? [], input.state.expectedClient.redirectUris),
    logoutUrisMatch: equalSets(
      readPostLogoutUris(input.state.clientRepresentation?.attributes),
      input.state.expectedClient.postLogoutRedirectUris
    ),
    webOriginsMatch: equalSets(input.state.clientRepresentation?.webOrigins ?? [], input.state.expectedClient.webOrigins),
    clientSecretConfigured: input.authClientSecretConfigured,
    tenantClientSecretReadable: Boolean(input.authClientSecret),
    clientSecretAligned,
    runtimeSecretSource: input.authClientSecret ? 'tenant' : 'global',
  };
};
