import { mkdtempSync, rmSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  getKeycloakAdminClientSecret,
  getKeycloakProvisionerClientSecret,
} from '../../../packages/auth-runtime/src/runtime-secrets.ts';
import type { AuditCheckResult, AuditRegistryTarget } from './model.ts';

const execFileAsync = promisify(execFile);

const REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES = [
  'manage-users',
  'view-users',
  'view-realm',
  'manage-realm',
  'manage-clients',
] as const;

type KeycloakClientRepresentation = Readonly<{
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

type KeycloakUserRepresentation = Readonly<{
  id: string;
  username?: string;
  enabled?: boolean;
}>;

type KeycloakRoleRepresentation = Readonly<{
  id: string;
  name: string;
}>;

const normalizeList = (values: readonly string[] | undefined): string[] =>
  [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const readPostLogoutUris = (attributes: Readonly<Record<string, string>> | undefined): string[] =>
  normalizeList(
    (attributes?.['post.logout.redirect.uris'] ?? '')
      .split('##')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const expectedOrigin = (hostname: string) => `https://${hostname}`;

const expectedLoginClientConfig = (hostname: string) => {
  const origin = expectedOrigin(hostname);
  return {
    postLogoutRedirectUris: normalizeList([`${origin}/`, '+']),
    redirectUris: normalizeList([`${origin}/auth/callback`]),
    rootUrl: origin,
    webOrigins: normalizeList([origin]),
  };
};

const expectedTenantAdminClientFlags = {
  directAccessGrantsEnabled: false,
  serviceAccountsEnabled: true,
  standardFlowEnabled: false,
} as const;

const ensureEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const withKcadmConfig = async <T>(work: (configPath: string) => Promise<T>): Promise<T> => {
  const configPath = join(mkdtempSync(join(tmpdir(), 'studio-instance-audit-kcadm-')), 'kcadm.config');
  try {
    const clientSecret = getKeycloakProvisionerClientSecret() ?? getKeycloakAdminClientSecret();
    if (!clientSecret) {
      throw new Error('Missing Keycloak admin client secret');
    }
    const baseUrl = process.env.KEYCLOAK_PROVISIONER_BASE_URL?.trim()
      || process.env.KEYCLOAK_ADMIN_BASE_URL?.trim();
    const realm = process.env.KEYCLOAK_PROVISIONER_REALM?.trim()
      || process.env.KEYCLOAK_ADMIN_REALM?.trim();
    const clientId = process.env.KEYCLOAK_PROVISIONER_CLIENT_ID?.trim()
      || process.env.KEYCLOAK_ADMIN_CLIENT_ID?.trim();
    if (!baseUrl || !realm || !clientId) {
      throw new Error('Missing Keycloak provisioner/admin configuration');
    }

    await execFileAsync('kcadm.sh', [
      'config',
      'credentials',
      '--server',
      baseUrl,
      '--realm',
      realm,
      '--client',
      clientId,
      '--client-secret',
      clientSecret,
      '--config',
      configPath,
    ]);
    return await work(configPath);
  } finally {
    rmSync(configPath, { force: true });
    rmSync(join(configPath, '..'), { force: true, recursive: true });
  }
};

const runKcadmJson = async <T>(configPath: string, args: readonly string[]): Promise<T> => {
  const result = await execFileAsync('kcadm.sh', [...args, '--config', configPath], {
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(result.stdout) as T;
};

const findRealmRoleUser = async (
  configPath: string,
  realm: string,
  roleName: string,
): Promise<KeycloakUserRepresentation | null> => {
  const users = await runKcadmJson<readonly KeycloakUserRepresentation[]>(configPath, [
    'get',
    `roles/${roleName}/users`,
    '-r',
    realm,
  ]);
  return users.find((user) => user.enabled !== false) ?? null;
};

const listUserRealmRoles = async (
  configPath: string,
  realm: string,
  userId: string,
): Promise<readonly string[]> => {
  const roles = await runKcadmJson<readonly KeycloakRoleRepresentation[]>(configPath, [
    'get',
    `users/${userId}/role-mappings/realm`,
    '-r',
    realm,
  ]);
  return roles.map((role) => role.name);
};

const listTenantAdminServiceRoles = async (
  configPath: string,
  realm: string,
  clientId: string,
): Promise<readonly string[]> => {
  const tenantAdminClients = await runKcadmJson<readonly KeycloakClientRepresentation[]>(configPath, [
    'get',
    'clients',
    '-r',
    realm,
    '-q',
    `clientId=${clientId}`,
  ]);
  const tenantAdminClient = tenantAdminClients[0];
  if (!tenantAdminClient?.id) {
    return [];
  }
  const realmManagementClients = await runKcadmJson<readonly KeycloakClientRepresentation[]>(configPath, [
    'get',
    'clients',
    '-r',
    realm,
    '-q',
    'clientId=realm-management',
  ]);
  const realmManagementClient = realmManagementClients[0];
  if (!realmManagementClient?.id) {
    return [];
  }
  const serviceUser = await runKcadmJson<KeycloakUserRepresentation>(configPath, [
    'get',
    `clients/${tenantAdminClient.id}/service-account-user`,
    '-r',
    realm,
  ]);
  if (!serviceUser.id) {
    return [];
  }
  const roles = await runKcadmJson<readonly KeycloakRoleRepresentation[]>(configPath, [
    'get',
    `users/${serviceUser.id}/role-mappings/clients/${realmManagementClient.id}`,
    '-r',
    realm,
  ]);
  return roles.map((role) => role.name);
};

const listRealmRoles = async (configPath: string, realm: string): Promise<readonly string[]> => {
  const roles = await runKcadmJson<readonly KeycloakRoleRepresentation[]>(configPath, ['get', 'roles', '-r', realm]);
  return roles.map((role) => role.name);
};

const readKeycloakClientSecret = async (
  configPath: string,
  realm: string,
  clientId: string,
): Promise<string | null> => {
  const secret = await runKcadmJson<{ value?: string }>(configPath, [
    'get',
    `clients/${clientId}/client-secret`,
    '-r',
    realm,
  ]).catch(() => null);
  return secret?.value ?? null;
};

export const inspectRealmAndClients = async (
  target: AuditRegistryTarget,
  deps: {
    authSecret?: string;
    tenantAdminSecret?: string;
  } = {},
): Promise<{ checks: readonly AuditCheckResult[] }> => {
  const expectedLogin = expectedLoginClientConfig(target.primaryHostname);

  return withKcadmConfig(async (configPath) => {
    const realm = await runKcadmJson<{ realm: string }>(configPath, ['get', `realms/${target.authRealm}`]).catch(
      () => null,
    );
    if (!realm) {
      return {
        checks: [
          {
            checkId: 'keycloak.realm.exists',
            status: 'fail',
            summary: 'realm missing',
            title: 'Tenant-Realm existiert',
          },
        ],
      };
    }
    const loginClients = await runKcadmJson<readonly KeycloakClientRepresentation[]>(configPath, [
      'get',
      'clients',
      '-r',
      target.authRealm,
      '-q',
      `clientId=${target.authClientId}`,
    ]);
    const loginClient = loginClients[0] ?? null;
    const loginSecret = loginClient?.id
      ? await readKeycloakClientSecret(configPath, target.authRealm, loginClient.id)
      : null;
    const tenantAdminClients = target.tenantAdminClientId
      ? await runKcadmJson<readonly KeycloakClientRepresentation[]>(configPath, [
          'get',
          'clients',
          '-r',
          target.authRealm,
          '-q',
          `clientId=${target.tenantAdminClientId}`,
        ])
      : [];
    const tenantAdminClient = tenantAdminClients[0] ?? null;
    const tenantAdminSecret = tenantAdminClient?.id
      ? await readKeycloakClientSecret(configPath, target.authRealm, tenantAdminClient.id)
      : null;
    const realmRoles = await listRealmRoles(configPath, target.authRealm);
    const systemAdminUser = realmRoles.includes('system_admin')
      ? await findRealmRoleUser(configPath, target.authRealm, 'system_admin')
      : null;
    const systemAdminUserRoles = systemAdminUser?.id
      ? await listUserRealmRoles(configPath, target.authRealm, systemAdminUser.id)
      : [];
    const tenantAdminServiceRoles = target.tenantAdminClientId
      ? await listTenantAdminServiceRoles(configPath, target.authRealm, target.tenantAdminClientId)
      : [];

    const checks: AuditCheckResult[] = [
      {
        checkId: 'keycloak.realm.exists',
        status: realm?.realm === target.authRealm ? 'pass' : 'fail',
        summary: realm?.realm ?? 'realm missing',
        title: 'Tenant-Realm existiert',
      },
      {
        checkId: 'keycloak.client.login.exists',
        status: loginClient ? 'pass' : 'fail',
        summary: target.authClientId,
        title: 'Login-Client existiert',
      },
      {
        checkId: 'keycloak.client.login.urls',
        details: {
          actualPostLogoutRedirectUris: loginClient ? readPostLogoutUris(loginClient.attributes) : [],
          actualRedirectUris: loginClient ? normalizeList(loginClient.redirectUris) : [],
          actualRootUrl: loginClient?.rootUrl,
          actualWebOrigins: loginClient ? normalizeList(loginClient.webOrigins) : [],
        },
        status:
          loginClient
          && loginClient.rootUrl === expectedLogin.rootUrl
          && JSON.stringify(normalizeList(loginClient.redirectUris)) === JSON.stringify(expectedLogin.redirectUris)
          && JSON.stringify(normalizeList(loginClient.webOrigins)) === JSON.stringify(expectedLogin.webOrigins)
          && JSON.stringify(readPostLogoutUris(loginClient.attributes)) === JSON.stringify(expectedLogin.postLogoutRedirectUris)
            ? 'pass'
            : 'fail',
        summary: target.primaryHostname,
        title: 'Login-Client-URLs stimmen exakt',
      },
      {
        checkId: 'secrets.login.aligned',
        status: deps.authSecret && loginSecret ? (deps.authSecret === loginSecret ? 'pass' : 'fail') : 'fail',
        summary: deps.authSecret && loginSecret ? 'tenant secret compared' : 'secret missing',
        title: 'Login-Client-Secret ist aligned',
      },
      {
        checkId: 'keycloak.client.tenant_admin.exists',
        status: tenantAdminClient ? 'pass' : 'fail',
        summary: target.tenantAdminClientId,
        title: 'Tenant-Admin-Client existiert',
      },
      {
        checkId: 'keycloak.client.tenant_admin.flags',
        details: {
          directAccessGrantsEnabled: tenantAdminClient?.directAccessGrantsEnabled,
          serviceAccountsEnabled: tenantAdminClient?.serviceAccountsEnabled,
          standardFlowEnabled: tenantAdminClient?.standardFlowEnabled,
        },
        status:
          tenantAdminClient
          && tenantAdminClient.directAccessGrantsEnabled === expectedTenantAdminClientFlags.directAccessGrantsEnabled
          && tenantAdminClient.serviceAccountsEnabled === expectedTenantAdminClientFlags.serviceAccountsEnabled
          && tenantAdminClient.standardFlowEnabled === expectedTenantAdminClientFlags.standardFlowEnabled
            ? 'pass'
            : 'fail',
        summary: target.tenantAdminClientId,
        title: 'Tenant-Admin-Client-Flags stimmen',
      },
      {
        checkId: 'secrets.tenant_admin.aligned',
        status:
          deps.tenantAdminSecret && tenantAdminSecret
            ? deps.tenantAdminSecret === tenantAdminSecret ? 'pass' : 'fail'
            : 'fail',
        summary: deps.tenantAdminSecret && tenantAdminSecret ? 'tenant admin secret compared' : 'secret missing',
        title: 'Tenant-Admin-Client-Secret ist aligned',
      },
      {
        checkId: 'keycloak.client.tenant_admin.roles',
        details: { assignedRoles: tenantAdminServiceRoles },
        status: REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES.every((roleName) => tenantAdminServiceRoles.includes(roleName))
          ? 'pass'
          : 'fail',
        summary: target.tenantAdminClientId,
        title: 'Tenant-Admin-Serviceaccount hat realm-management-Rollen',
      },
      {
        checkId: 'keycloak.role.system_admin.exists',
        status: realmRoles.includes('system_admin') ? 'pass' : 'fail',
        summary: 'system_admin',
        title: 'Realm-Rolle system_admin existiert',
      },
      {
        checkId: 'keycloak.user.system_admin.exists',
        details: { username: systemAdminUser?.username },
        status: systemAdminUser ? 'pass' : 'fail',
        summary: systemAdminUser?.username ?? 'no active system_admin user',
        title: 'Aktiver system_admin-User existiert',
      },
      {
        checkId: 'keycloak.user.system_admin.not_instance_registry_admin',
        details: { roles: systemAdminUserRoles },
        status: systemAdminUser
          ? systemAdminUserRoles.includes('instance_registry_admin') ? 'fail' : 'pass'
          : 'skip',
        summary: systemAdminUser ? 'role set inspected' : 'no system_admin user',
        title: 'system_admin-User trägt nicht instance_registry_admin',
      },
      {
        checkId: 'tenant_iam.access',
        details: { assignedRoles: tenantAdminServiceRoles },
        status: REQUIRED_TENANT_ADMIN_CLIENT_ROLE_NAMES.every((roleName) => tenantAdminServiceRoles.includes(roleName))
          ? 'pass'
          : 'fail',
        summary: target.tenantAdminClientId,
        title: 'Tenant-IAM-Zugriff ist funktionsfähig',
      },
      {
        checkId: 'keycloak.mapper.instance_id',
        status: 'warn',
        summary: 'optional mapper not yet inspected separately',
        title: 'instanceId-Mapper prüfen',
      },
      {
        checkId: 'keycloak.bootstrap_user.profile',
        status: target.tenantAdminUsername ? 'pass' : 'warn',
        summary: target.tenantAdminUsername ?? 'bootstrap user missing',
        title: 'Bootstrap-Admin-Stammdaten sind gepflegt',
      },
    ];

    return { checks };
  });
};
