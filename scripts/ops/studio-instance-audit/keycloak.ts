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
import { evaluateKeycloakAuditChecks, type KeycloakClientSnapshot } from './keycloak-evaluation.ts';

const execFileAsync = promisify(execFile);

type KeycloakUserRepresentation = Readonly<{
  id: string;
  username?: string;
  enabled?: boolean;
}>;

type KeycloakRoleRepresentation = Readonly<{
  id: string;
  name: string;
}>;

const withKcadmConfig = async <T>(work: (configPath: string) => Promise<T>): Promise<T> => {
  const configPath = join(
    mkdtempSync(join(tmpdir(), 'studio-instance-audit-kcadm-')),
    'kcadm.config'
  );
  try {
    const clientSecret = getKeycloakProvisionerClientSecret() ?? getKeycloakAdminClientSecret();
    if (!clientSecret) {
      throw new Error('Missing Keycloak admin client secret');
    }
    const baseUrl =
      process.env.KEYCLOAK_PROVISIONER_BASE_URL?.trim() ||
      process.env.KEYCLOAK_ADMIN_BASE_URL?.trim();
    const realm =
      process.env.KEYCLOAK_PROVISIONER_REALM?.trim() || process.env.KEYCLOAK_ADMIN_REALM?.trim();
    const clientId =
      process.env.KEYCLOAK_PROVISIONER_CLIENT_ID?.trim() ||
      process.env.KEYCLOAK_ADMIN_CLIENT_ID?.trim();
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
  roleName: string
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
  userId: string
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
  clientId: string
): Promise<readonly string[]> => {
  const tenantAdminClients = await runKcadmJson<readonly KeycloakClientSnapshot[]>(configPath, [
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
  const realmManagementClients = await runKcadmJson<readonly KeycloakClientSnapshot[]>(configPath, [
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
  const roles = await runKcadmJson<readonly KeycloakRoleRepresentation[]>(configPath, [
    'get',
    'roles',
    '-r',
    realm,
  ]);
  return roles.map((role) => role.name);
};

const readKeycloakClientSecret = async (
  configPath: string,
  realm: string,
  clientId: string
): Promise<string | null> => {
  const secret = await runKcadmJson<{ value?: string }>(configPath, [
    'get',
    `clients/${clientId}/client-secret`,
    '-r',
    realm,
  ]).catch(() => null);
  return secret?.value ?? null;
};

const readClientAndSecret = async (
  configPath: string,
  realm: string,
  clientId: string
): Promise<Readonly<{ client: KeycloakClientSnapshot | null; secret: string | null }>> => {
  const clients = await runKcadmJson<readonly KeycloakClientSnapshot[]>(configPath, [
    'get',
    'clients',
    '-r',
    realm,
    '-q',
    `clientId=${clientId}`,
  ]);
  const client = clients[0] ?? null;
  const secret = client?.id ? await readKeycloakClientSecret(configPath, realm, client.id) : null;
  return { client, secret };
};

const readOptionalClientAndSecret = async (
  configPath: string,
  realm: string,
  clientId: string | undefined
): ReturnType<typeof readClientAndSecret> =>
  clientId ? readClientAndSecret(configPath, realm, clientId) : { client: null, secret: null };

const readSystemAdminState = async (
  configPath: string,
  realm: string,
  realmRoles: readonly string[]
): Promise<
  Readonly<{
    systemAdminUser: KeycloakUserRepresentation | null;
    systemAdminUserRoles: readonly string[];
  }>
> => {
  if (!realmRoles.includes('system_admin')) {
    return { systemAdminUser: null, systemAdminUserRoles: [] };
  }
  const systemAdminUser = await findRealmRoleUser(configPath, realm, 'system_admin');
  const systemAdminUserRoles = systemAdminUser?.id
    ? await listUserRealmRoles(configPath, realm, systemAdminUser.id)
    : [];
  return { systemAdminUser, systemAdminUserRoles };
};

const collectKeycloakAuditSnapshot = async (configPath: string, target: AuditRegistryTarget) => {
  const login = await readClientAndSecret(configPath, target.authRealm, target.authClientId);
  const tenantAdmin = await readOptionalClientAndSecret(
    configPath,
    target.authRealm,
    target.tenantAdminClientId
  );
  const realmRoles = await listRealmRoles(configPath, target.authRealm);
  const systemAdmin = await readSystemAdminState(configPath, target.authRealm, realmRoles);
  const tenantAdminServiceRoles = target.tenantAdminClientId
    ? await listTenantAdminServiceRoles(configPath, target.authRealm, target.tenantAdminClientId)
    : [];

  return {
    loginClient: login.client,
    loginSecret: login.secret,
    realmRoles,
    systemAdminUser: systemAdmin.systemAdminUser,
    systemAdminUserRoles: systemAdmin.systemAdminUserRoles,
    tenantAdminClient: tenantAdmin.client,
    tenantAdminSecret: tenantAdmin.secret,
    tenantAdminServiceRoles,
  };
};

export const inspectRealmAndClients = async (
  target: AuditRegistryTarget,
  deps: {
    authSecret?: string;
    tenantAdminSecret?: string;
  } = {}
): Promise<{ checks: readonly AuditCheckResult[] }> => {
  return withKcadmConfig(async (configPath) => {
    const realm = await runKcadmJson<{ realm: string }>(configPath, [
      'get',
      `realms/${target.authRealm}`,
    ]).catch(() => null);
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
    const snapshot = await collectKeycloakAuditSnapshot(configPath, target);

    return {
      checks: evaluateKeycloakAuditChecks(
        target,
        {
          ...snapshot,
          realmName: realm.realm,
        },
        deps
      ),
    };
  });
};
