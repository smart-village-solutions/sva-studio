import type { AuditCheckResult, AuditRegistryTarget } from './model.ts';

export const REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES = [
  'manage-users',
  'view-users',
  'view-realm',
  'manage-realm',
  'manage-clients',
] as const;

export type KeycloakClientSnapshot = Readonly<{
  id: string;
  clientId: string;
  rootUrl?: string;
  redirectUris?: readonly string[];
  webOrigins?: readonly string[];
  attributes?: Readonly<Record<string, string>>;
  standardFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
}>;

export type KeycloakAuditSnapshot = Readonly<{
  loginClient: KeycloakClientSnapshot | null;
  loginSecret: string | null;
  realmName: string;
  realmRoles: readonly string[];
  systemAdminUser: Readonly<{ username?: string }> | null;
  systemAdminUserRoles: readonly string[];
  tenantAdminClient: KeycloakClientSnapshot | null;
  tenantAdminSecret: string | null;
  tenantAdminServiceRoles: readonly string[];
}>;

type ExpectedSecrets = Readonly<{
  authSecret?: string;
  tenantAdminSecret?: string;
}>;

const normalizeList = (values: readonly string[] | undefined): string[] =>
  [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const readPostLogoutUris = (attributes: Readonly<Record<string, string>> | undefined): string[] =>
  normalizeList(
    (attributes?.['post.logout.redirect.uris'] ?? '')
      .split('##')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

const expectedLoginClientConfig = (hostname: string) => {
  const origin = `https://${hostname}`;
  return {
    postLogoutRedirectUris: normalizeList([`${origin}/`, '+']),
    redirectUris: normalizeList([`${origin}/auth/callback`]),
    rootUrl: origin,
    webOrigins: normalizeList([origin]),
  };
};

const sameList = (actual: readonly string[], expected: readonly string[]): boolean =>
  JSON.stringify(actual) === JSON.stringify(expected);

const hasTenantAdminRoles = (roles: readonly string[]): boolean =>
  REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES.every((roleName) => roles.includes(roleName));

type LoginUrlState = Readonly<{
  postLogoutRedirectUris: readonly string[];
  redirectUris: readonly string[];
  rootUrl?: string;
  webOrigins: readonly string[];
}>;

const readLoginUrlState = (client: KeycloakClientSnapshot | null): LoginUrlState => {
  if (!client) {
    return { postLogoutRedirectUris: [], redirectUris: [], webOrigins: [] };
  }
  return {
    postLogoutRedirectUris: readPostLogoutUris(client.attributes),
    redirectUris: normalizeList(client.redirectUris),
    rootUrl: client.rootUrl,
    webOrigins: normalizeList(client.webOrigins),
  };
};

const loginUrlsAligned = (
  client: KeycloakClientSnapshot | null,
  actual: LoginUrlState,
  expected: LoginUrlState
): boolean =>
  client !== null &&
  [
    actual.rootUrl === expected.rootUrl,
    sameList(actual.redirectUris, expected.redirectUris),
    sameList(actual.webOrigins, expected.webOrigins),
    sameList(actual.postLogoutRedirectUris, expected.postLogoutRedirectUris),
  ].every(Boolean);

const buildLoginUrlCheck = (
  target: AuditRegistryTarget,
  client: KeycloakClientSnapshot | null
): AuditCheckResult => {
  const actual = readLoginUrlState(client);
  const expected = expectedLoginClientConfig(target.primaryHostname);
  return {
    checkId: 'keycloak.client.login.urls',
    details: {
      actualPostLogoutRedirectUris: actual.postLogoutRedirectUris,
      actualRedirectUris: actual.redirectUris,
      actualRootUrl: actual.rootUrl,
      actualWebOrigins: actual.webOrigins,
    },
    status: loginUrlsAligned(client, actual, expected) ? 'pass' : 'fail',
    summary: target.primaryHostname,
    title: 'Login-Client-URLs stimmen exakt',
  };
};

const buildLoginSecretCheck = (
  expectedSecret: string | undefined,
  actualSecret: string | null
): AuditCheckResult => {
  if (!expectedSecret || !actualSecret) {
    return {
      checkId: 'secrets.login.aligned',
      status: 'fail',
      summary: 'secret missing',
      title: 'Login-Client-Secret ist aligned',
    };
  }
  return {
    checkId: 'secrets.login.aligned',
    status: expectedSecret === actualSecret ? 'pass' : 'fail',
    summary: 'tenant secret compared',
    title: 'Login-Client-Secret ist aligned',
  };
};

const buildLoginChecks = (
  target: AuditRegistryTarget,
  snapshot: KeycloakAuditSnapshot,
  secrets: ExpectedSecrets
): readonly AuditCheckResult[] => {
  const client = snapshot.loginClient;
  return [
    {
      checkId: 'keycloak.client.login.exists',
      status: client ? 'pass' : 'fail',
      summary: target.authClientId,
      title: 'Login-Client existiert',
    },
    buildLoginUrlCheck(target, client),
    buildLoginSecretCheck(secrets.authSecret, snapshot.loginSecret),
  ];
};

const tenantAdminFlagsAligned = (client: KeycloakClientSnapshot | null): boolean =>
  client !== null &&
  [
    client.directAccessGrantsEnabled === false,
    client.serviceAccountsEnabled === true,
    client.standardFlowEnabled === false,
  ].every(Boolean);

const buildTenantAdminSecretCheck = (
  expectedSecret: string | undefined,
  actualSecret: string | null
): AuditCheckResult => {
  if (!expectedSecret || !actualSecret) {
    return {
      checkId: 'secrets.tenant_admin.aligned',
      status: 'fail',
      summary: 'secret missing',
      title: 'Tenant-Admin-Client-Secret ist aligned',
    };
  }
  return {
    checkId: 'secrets.tenant_admin.aligned',
    status: expectedSecret === actualSecret ? 'pass' : 'fail',
    summary: 'tenant admin secret compared',
    title: 'Tenant-Admin-Client-Secret ist aligned',
  };
};

const buildTenantAdminExistenceCheck = (
  target: AuditRegistryTarget,
  client: KeycloakClientSnapshot | null
): AuditCheckResult => ({
  checkId: 'keycloak.client.tenant_admin.exists',
  status: client ? 'pass' : 'fail',
  summary: target.tenantAdminClientId,
  title: 'Tenant-Admin-Client existiert',
});

const buildTenantAdminFlagsCheck = (
  target: AuditRegistryTarget,
  client: KeycloakClientSnapshot | null
): AuditCheckResult => ({
  checkId: 'keycloak.client.tenant_admin.flags',
  details: {
    directAccessGrantsEnabled: client?.directAccessGrantsEnabled,
    serviceAccountsEnabled: client?.serviceAccountsEnabled,
    standardFlowEnabled: client?.standardFlowEnabled,
  },
  status: tenantAdminFlagsAligned(client) ? 'pass' : 'fail',
  summary: target.tenantAdminClientId,
  title: 'Tenant-Admin-Client-Flags stimmen',
});

const buildTenantAdminRolesCheck = (
  target: AuditRegistryTarget,
  roles: readonly string[]
): AuditCheckResult => ({
  checkId: 'keycloak.client.tenant_admin.roles',
  details: { assignedRoles: roles },
  status: hasTenantAdminRoles(roles) ? 'pass' : 'fail',
  summary: target.tenantAdminClientId,
  title: 'Tenant-Admin-Serviceaccount hat realm-management-Rollen',
});

const buildTenantAdminChecks = (
  target: AuditRegistryTarget,
  snapshot: KeycloakAuditSnapshot,
  secrets: ExpectedSecrets
): readonly AuditCheckResult[] => {
  const client = snapshot.tenantAdminClient;
  return [
    buildTenantAdminExistenceCheck(target, client),
    buildTenantAdminFlagsCheck(target, client),
    buildTenantAdminSecretCheck(secrets.tenantAdminSecret, snapshot.tenantAdminSecret),
    buildTenantAdminRolesCheck(target, snapshot.tenantAdminServiceRoles),
  ];
};

const buildSystemAdminRoleCheck = (realmRoles: readonly string[]): AuditCheckResult => ({
  checkId: 'keycloak.role.system_admin.exists',
  status: realmRoles.includes('system_admin') ? 'pass' : 'fail',
  summary: 'system_admin',
  title: 'Realm-Rolle system_admin existiert',
});

const buildSystemAdminUserCheck = (
  user: KeycloakAuditSnapshot['systemAdminUser']
): AuditCheckResult => ({
  checkId: 'keycloak.user.system_admin.exists',
  details: { username: user?.username },
  status: user ? 'pass' : 'fail',
  summary: user?.username ?? 'no active system_admin user',
  title: 'Aktiver system_admin-User existiert',
});

const buildSystemAdminRoleSeparationCheck = (
  user: KeycloakAuditSnapshot['systemAdminUser'],
  roles: readonly string[]
): AuditCheckResult => ({
  checkId: 'keycloak.user.system_admin.not_instance_registry_admin',
  details: { roles },
  status: user ? (roles.includes('instance_registry_admin') ? 'fail' : 'pass') : 'skip',
  summary: user ? 'role set inspected' : 'no system_admin user',
  title: 'system_admin-User trägt nicht instance_registry_admin',
});

const buildSystemAdminChecks = (snapshot: KeycloakAuditSnapshot): readonly AuditCheckResult[] => {
  const user = snapshot.systemAdminUser;
  return [
    buildSystemAdminRoleCheck(snapshot.realmRoles),
    buildSystemAdminUserCheck(user),
    buildSystemAdminRoleSeparationCheck(user, snapshot.systemAdminUserRoles),
  ];
};

const buildTenantIamAccessCheck = (
  target: AuditRegistryTarget,
  roles: readonly string[]
): AuditCheckResult => ({
  checkId: 'tenant_iam.access',
  details: { assignedRoles: roles },
  status: hasTenantAdminRoles(roles) ? 'pass' : 'fail',
  summary: target.tenantAdminClientId,
  title: 'Tenant-IAM-Zugriff ist funktionsfähig',
});

const buildBootstrapProfileCheck = (target: AuditRegistryTarget): AuditCheckResult => ({
  checkId: 'keycloak.bootstrap_user.profile',
  status: target.tenantAdminUsername ? 'pass' : 'warn',
  summary: target.tenantAdminUsername ?? 'bootstrap user missing',
  title: 'Bootstrap-Admin-Stammdaten sind gepflegt',
});

export const evaluateKeycloakAuditChecks = (
  target: AuditRegistryTarget,
  snapshot: KeycloakAuditSnapshot,
  secrets: ExpectedSecrets
): readonly AuditCheckResult[] => [
  {
    checkId: 'keycloak.realm.exists',
    status: snapshot.realmName === target.authRealm ? 'pass' : 'fail',
    summary: snapshot.realmName,
    title: 'Tenant-Realm existiert',
  },
  ...buildLoginChecks(target, snapshot, secrets),
  ...buildTenantAdminChecks(target, snapshot, secrets),
  ...buildSystemAdminChecks(snapshot),
  buildTenantIamAccessCheck(target, snapshot.tenantAdminServiceRoles),
  {
    checkId: 'keycloak.mapper.instance_id',
    status: 'warn',
    summary: 'optional mapper not yet inspected separately',
    title: 'instanceId-Mapper prüfen',
  },
  buildBootstrapProfileCheck(target),
];
