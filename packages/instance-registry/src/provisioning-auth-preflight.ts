import type { InstanceKeycloakPreflightCheck, InstanceRealmMode } from '@sva/core';
import type { KeycloakTenantPreflight } from './keycloak-types.js';
import type {
  KeycloakProvisioningInput,
  KeycloakReadState,
  TenantAdminBootstrap,
} from './provisioning-auth-types.js';
import { readRealmOwnershipConflicts } from './provisioning-auth-ownership.js';

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
  state?: KeycloakReadState;
}): InstanceKeycloakPreflightCheck => {
  const hasReadableSecret = Boolean(input.authClientSecret);
  const canCreateLoginClient =
    !input.authClientSecretConfigured &&
    Boolean(input.state?.realm) &&
    input.state?.clientRepresentation === null;
  const generatedDuringProvisioning = input.realmMode === 'new' || canCreateLoginClient;
  const requiresTenantSecret = !generatedDuringProvisioning;
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
    generatedDuringProvisioning,
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
    : 'Das Tenant-Client-Secret wird beim Anlegen des Clients automatisch erzeugt und anschließend gespeichert.';
};

const buildTenantAdminCheck = (
  _realmMode: InstanceRealmMode,
  tenantAdminBootstrap?: TenantAdminBootstrap
): InstanceKeycloakPreflightCheck => {
  const missingFields = [
    !tenantAdminBootstrap?.username ? 'username' : undefined,
    !tenantAdminBootstrap?.email ? 'email' : undefined,
    !tenantAdminBootstrap?.firstName ? 'firstName' : undefined,
    !tenantAdminBootstrap?.lastName ? 'lastName' : undefined,
  ].filter((field): field is string => Boolean(field));
  const configured = missingFields.length === 0;
  return createPreflightCheck(
    'tenant_admin_profile',
    'Tenant-Admin-Profil',
    configured ? 'ready' : 'blocked',
    configured
      ? 'Die Stammdaten für den Tenant-Admin sind gepflegt.'
      : 'Für den Tenant-Admin fehlen vollständige Stammdaten.',
    { configured, missingFields }
  );
};

const buildTenantAdminClientCheck = (input: {
  tenantAdminClient?: KeycloakProvisioningInput['tenantAdminClient'];
  tenantAdminClientSecret?: string;
  state?: KeycloakReadState;
}): InstanceKeycloakPreflightCheck => {
  const configured = Boolean(input.tenantAdminClient?.clientId);
  const readable = Boolean(input.tenantAdminClientSecret);
  const accessUnreadable = Boolean(
    input.state?.tenantAdminClientRepresentation?.serviceAccountsEnabled &&
    !input.state.tenantAdminServiceAccess
  );
  return createPreflightCheck(
    'tenant_admin_client',
    'Tenant-Admin-Client',
    configured && !accessUnreadable ? 'ready' : 'blocked',
    accessUnreadable
      ? 'Die Service-Account-Rechte konnten nicht gelesen werden.'
      : resolveTenantAdminClientSummary(configured, readable),
    {
      configured,
      clientId: input.tenantAdminClient?.clientId,
      secretConfigured: input.tenantAdminClient?.secretConfigured ?? false,
      readable,
      ...(accessUnreadable ? { reasonCode: 'tenant_admin_service_access_unreadable' } : {}),
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
  instanceId?: string;
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
    createPreflightCheck(
      'platform_access',
      'Plattformzugriff',
      'ready',
      'Der aufrufende Benutzer ist für die Root-Host-Instanzverwaltung autorisiert.'
    ),
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
      state: input.state,
    }),
    buildTenantAdminClientCheck({
      tenantAdminClient: input.tenantAdminClient,
      tenantAdminClientSecret: input.tenantAdminClientSecret,
      state: input.state,
    }),
    buildTenantAdminCheck(input.realmMode, input.tenantAdminBootstrap)
  );

  if (input.realmMode === 'existing' && input.instanceId && input.state?.realm) {
    const conflicts = readRealmOwnershipConflicts(
      input.state,
      input.instanceId,
      input.tenantAdminBootstrap
    );
    checks.push(
      createPreflightCheck(
        'realm_ownership',
        'Studio-Eigentum der Realm-Artefakte',
        conflicts.length > 0 ? 'blocked' : 'ready',
        conflicts.length > 0
          ? 'Mindestens ein gleichnamiges Artefakt ist nicht eindeutig dieser Studio-Instanz zugeordnet.'
          : 'Vorhandene Studio-Artefakte sind eindeutig dieser Instanz zugeordnet; fehlende Artefakte können ergänzt werden.',
        {
          reasonCode: conflicts.length > 0 ? 'artifact_ownership_conflict' : 'ownership_verified',
          conflictingArtifactKeys: conflicts,
        }
      )
    );
  }

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
