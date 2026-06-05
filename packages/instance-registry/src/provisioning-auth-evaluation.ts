import type { InstanceKeycloakPreflightCheck, InstanceRealmMode } from '@sva/core';
import type { KeycloakTenantPreflight, KeycloakTenantStatus } from './keycloak-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState, TenantAdminBootstrap } from './provisioning-auth-types.js';
import { equalSets, readPostLogoutUris } from './provisioning-auth-utils.js';
export { buildPlan } from './provisioning-auth-plan.js';

export const buildMissingRealmStatus = (
  authClientSecretConfigured: boolean,
  authClientSecret?: string,
  tenantAdminClient?: KeycloakProvisioningInput['tenantAdminClient'],
  tenantAdminClientSecret?: string
): KeycloakTenantStatus => ({
  realmExists: false,
  clientExists: false,
  tenantAdminClientExists: false,
  tenantAdminExists: false,
  tenantAdminHasSystemAdmin: false,
  redirectUrisMatch: false,
  logoutUrisMatch: false,
  webOriginsMatch: false,
  clientSecretConfigured: authClientSecretConfigured,
  tenantClientSecretReadable: Boolean(authClientSecret),
  clientSecretAligned: false,
  tenantAdminClientSecretConfigured: tenantAdminClient?.secretConfigured ?? false,
  tenantAdminClientSecretReadable: Boolean(tenantAdminClientSecret),
  tenantAdminClientSecretAligned: false,
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
  const status = resolveRealmModeStatus(input.realmMode, input.realmExists);
  const summary = resolveRealmModeSummary(input.realmMode, input.realmExists);

  return createPreflightCheck('realm_mode', 'Realm-Modus', status, summary, {
    realmExists: input.realmExists,
    realmMode: input.realmMode,
  });
};

const resolveRealmModeStatus = (
  realmMode: InstanceRealmMode,
  realmExists: boolean
): InstanceKeycloakPreflightCheck['status'] => {
  if (realmMode === 'new') {
    return realmExists ? 'blocked' : 'ready';
  }

  return realmExists ? 'ready' : 'blocked';
};

const resolveRealmModeSummary = (realmMode: InstanceRealmMode, realmExists: boolean): string => {
  if (realmMode === 'new') {
    return realmExists
      ? 'Der Realm existiert bereits, obwohl "Neuer Realm" gewählt wurde.'
      : 'Der Ziel-Realm fehlt und kann neu angelegt werden.';
  }

  return realmExists
    ? 'Der bestehende Realm ist erreichbar.'
    : 'Der gewählte Bestands-Realm wurde nicht gefunden.';
};

const buildTenantSecretCheck = (input: {
  realmMode: InstanceRealmMode;
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
}): InstanceKeycloakPreflightCheck => {
  const hasReadableSecret = Boolean(input.authClientSecret);
  const requiresTenantSecret = isTenantSecretRequired(input.realmMode);
  const status = resolveTenantSecretStatus(
    input.authClientSecretConfigured,
    hasReadableSecret,
    requiresTenantSecret
  );
  const summary = resolveTenantSecretSummary(
    input.authClientSecretConfigured,
    hasReadableSecret,
    requiresTenantSecret
  );

  return createPreflightCheck('tenant_secret', 'Tenant-Client-Secret', status, summary, {
    configured: input.authClientSecretConfigured,
    readable: hasReadableSecret,
    generatedDuringProvisioning: input.realmMode === 'new',
  });
};

const resolveTenantSecretStatus = (
  authClientSecretConfigured: boolean,
  hasReadableSecret: boolean,
  requiresTenantSecret: boolean
): InstanceKeycloakPreflightCheck['status'] => {
  if (authClientSecretConfigured && hasReadableSecret) {
    return 'ready';
  }

  return requiresTenantSecret ? 'blocked' : 'warning';
};

const resolveTenantSecretSummary = (
  authClientSecretConfigured: boolean,
  hasReadableSecret: boolean,
  requiresTenantSecret: boolean
): string => {
  if (authClientSecretConfigured && hasReadableSecret) {
    return 'Ein lesbares Tenant-Client-Secret ist in der Registry vorhanden.';
  }

  return requiresTenantSecret
    ? 'Für diese Instanz fehlt ein lesbares Tenant-Client-Secret in der Registry.'
    : 'Das Tenant-Client-Secret wird beim Erstellen des neuen Realm automatisch erzeugt und anschließend gespeichert.';
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

const buildTenantAdminClientCheck = (input: {
  tenantAdminClient?: KeycloakProvisioningInput['tenantAdminClient'];
  tenantAdminClientSecret?: string;
}): InstanceKeycloakPreflightCheck => {
  const configured = Boolean(input.tenantAdminClient?.clientId);
  const readable = Boolean(input.tenantAdminClientSecret);
  return createPreflightCheck(
    'tenant_admin_client',
    'Tenant-Admin-Client',
    configured ? 'ready' : 'blocked',
    resolveTenantAdminClientSummary(configured, readable),
    {
      configured,
      clientId: input.tenantAdminClient?.clientId,
      secretConfigured: input.tenantAdminClient?.secretConfigured ?? false,
      readable,
    }
  );
};

const resolveTenantAdminClientSummary = (configured: boolean, readable: boolean): string => {
  if (!configured) {
    return 'Für den technischen Tenant-Admin-Client fehlen die erforderlichen Vertragsdaten.';
  }

  return readable
    ? 'Der Tenant-Admin-Client und sein Secret sind konfiguriert.'
    : 'Der Tenant-Admin-Client ist konfiguriert; das Secret wird beim Worker-Lauf gelesen oder erzeugt.';
};

export const buildPreflightChecks = (input: {
  realmMode: InstanceRealmMode;
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminClient?: KeycloakProvisioningInput['tenantAdminClient'];
  tenantAdminClientSecret?: string;
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
    buildTenantAdminClientCheck({
      tenantAdminClient: input.tenantAdminClient,
      tenantAdminClientSecret: input.tenantAdminClientSecret,
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
  input: Pick<
    KeycloakProvisioningInput,
    | 'authClientSecretConfigured'
    | 'authClientSecret'
    | 'instanceId'
    | 'authRealm'
    | 'authClientId'
    | 'realmMode'
    | 'tenantAdminClient'
    | 'tenantAdminClientSecret'
  > & {
    state: KeycloakReadState;
  }
): KeycloakTenantStatus => {
  const clientSecretAligned = Boolean(
    input.authClientSecret && input.state.keycloakClientSecret && input.authClientSecret === input.state.keycloakClientSecret
  );
  const tenantAdminClientSecretAligned = Boolean(
    input.tenantAdminClientSecret &&
      input.state.tenantAdminClientSecret &&
      input.tenantAdminClientSecret === input.state.tenantAdminClientSecret
  );

  return {
    realmExists: true,
    clientExists: Boolean(input.state.clientRepresentation),
    tenantAdminClientExists: Boolean(input.state.tenantAdminClientRepresentation),
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
    tenantAdminClientSecretConfigured: input.tenantAdminClient?.secretConfigured ?? false,
    tenantAdminClientSecretReadable: Boolean(input.tenantAdminClientSecret),
    tenantAdminClientSecretAligned,
    runtimeSecretSource: input.authClientSecret ? 'tenant' : 'global',
  };
};
