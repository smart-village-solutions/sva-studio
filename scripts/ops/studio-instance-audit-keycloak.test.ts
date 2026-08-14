import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditRegistryTarget } from './studio-instance-audit/model.ts';

type KcadmResponse = Readonly<{
  stderr?: string;
  stdout: string;
}>;

const kcadmMock = vi.hoisted(
  (): {
    calls: string[][];
    responder: (args: readonly string[]) => Promise<KcadmResponse>;
  } => ({
    calls: [] as string[][],
    responder: async (): Promise<KcadmResponse> => ({ stdout: '' }),
  })
);

vi.mock('node:child_process', () => {
  const execFileMock = vi.fn();
  Object.defineProperty(execFileMock, promisify.custom, {
    value: async (_file: string, args: readonly string[]) => {
      kcadmMock.calls.push([...args]);
      return kcadmMock.responder(args);
    },
  });
  return { execFile: execFileMock };
});

vi.mock('../../packages/auth-runtime/src/runtime-secrets.ts', () => ({
  getKeycloakAdminClientSecret: () => undefined,
  getKeycloakProvisionerClientSecret: () => 'synthetic-provisioner-secret',
}));

const { inspectRealmAndClients } = await import('./studio-instance-audit/keycloak.ts');

const target: AuditRegistryTarget = {
  authClientSecretConfigured: true,
  authClientId: 'studio-login',
  authRealm: 'tenant-realm',
  displayName: 'Tenant',
  instanceId: 'tenant',
  parentDomain: 'studio.example.test',
  primaryHostname: 'tenant.studio.example.test',
  status: 'active',
  tenantAdminClientId: 'tenant-admin',
  tenantAdminClientSecretConfigured: true,
  tenantAdminUsername: 'bootstrap-admin',
};

const loginSecretMarker = 'synthetic-login-secret-marker';
const tenantAdminSecretMarker = 'synthetic-tenant-admin-secret-marker';

const commandKey = (args: readonly string[]): string => {
  if (args[0] === 'config') {
    return 'config credentials';
  }
  const configIndex = args.indexOf('--config');
  return args.slice(0, configIndex).join(' ');
};

type ScenarioOverrides = Readonly<{
  loginClient?: Readonly<Record<string, unknown>> | null;
  loginSecret?: string | null;
  realmExists?: boolean;
  realmRoles?: readonly string[];
  systemAdminRoles?: readonly string[];
  systemAdminUser?: Readonly<Record<string, unknown>> | null;
  tenantAdminClient?: Readonly<Record<string, unknown>> | null;
  tenantAdminSecret?: string | null;
  tenantAdminServiceRoles?: readonly string[];
}>;

const configureScenario = (overrides: ScenarioOverrides = {}): void => {
  const loginClient =
    overrides.loginClient === undefined
      ? {
          attributes: { 'post.logout.redirect.uris': 'https://tenant.studio.example.test/##+' },
          clientId: 'studio-login',
          id: 'login-internal-id',
          redirectUris: ['https://tenant.studio.example.test/auth/callback'],
          rootUrl: 'https://tenant.studio.example.test',
          webOrigins: ['https://tenant.studio.example.test'],
        }
      : overrides.loginClient;
  const tenantAdminClient =
    overrides.tenantAdminClient === undefined
      ? {
          clientId: 'tenant-admin',
          directAccessGrantsEnabled: false,
          id: 'tenant-admin-internal-id',
          serviceAccountsEnabled: true,
          standardFlowEnabled: false,
        }
      : overrides.tenantAdminClient;
  const systemAdminUser =
    overrides.systemAdminUser === undefined
      ? { enabled: true, id: 'system-admin-user-id', username: 'system-admin' }
      : overrides.systemAdminUser;
  const realmRoles = overrides.realmRoles ?? ['system_admin', 'instance_registry_admin'];
  const systemAdminRoles = overrides.systemAdminRoles ?? ['system_admin'];
  const tenantAdminServiceRoles = overrides.tenantAdminServiceRoles ?? [
    'manage-users',
    'view-users',
    'view-realm',
    'manage-realm',
    'manage-clients',
  ];

  kcadmMock.responder = async (args) => {
    const key = commandKey(args);
    const responseByCommand: Readonly<Record<string, unknown>> = {
      'config credentials': '',
      'get clients -r tenant-realm -q clientId=realm-management': [
        { clientId: 'realm-management', id: 'realm-management-id' },
      ],
      'get clients -r tenant-realm -q clientId=studio-login': loginClient ? [loginClient] : [],
      'get clients -r tenant-realm -q clientId=tenant-admin': tenantAdminClient
        ? [tenantAdminClient]
        : [],
      'get clients/login-internal-id/client-secret -r tenant-realm': {
        value: overrides.loginSecret === undefined ? loginSecretMarker : overrides.loginSecret,
      },
      'get clients/tenant-admin-internal-id/client-secret -r tenant-realm': {
        value:
          overrides.tenantAdminSecret === undefined
            ? tenantAdminSecretMarker
            : overrides.tenantAdminSecret,
      },
      'get clients/tenant-admin-internal-id/service-account-user -r tenant-realm': {
        id: 'tenant-admin-service-user-id',
      },
      'get realms/tenant-realm': { realm: 'tenant-realm' },
      'get roles -r tenant-realm': realmRoles.map((name) => ({ id: `${name}-id`, name })),
      'get roles/system_admin/users -r tenant-realm': systemAdminUser ? [systemAdminUser] : [],
      'get users/system-admin-user-id/role-mappings/realm -r tenant-realm': systemAdminRoles.map(
        (name) => ({
          id: `${name}-id`,
          name,
        })
      ),
      'get users/tenant-admin-service-user-id/role-mappings/clients/realm-management-id -r tenant-realm':
        tenantAdminServiceRoles.map((name) => ({ id: `${name}-id`, name })),
    };

    if (key === 'get realms/tenant-realm' && overrides.realmExists === false) {
      throw new Error('synthetic realm lookup failure');
    }
    if (!(key in responseByCommand)) {
      throw new Error(`Unexpected kcadm command: ${key}`);
    }
    return { stdout: JSON.stringify(responseByCommand[key]) };
  };
};

const readConfigPath = (): string => {
  const configCall = kcadmMock.calls[0] ?? [];
  const configIndex = configCall.indexOf('--config');
  const configPath = configCall[configIndex + 1];
  if (!configPath) {
    throw new Error('Expected kcadm config path');
  }
  return configPath;
};

describe('inspectRealmAndClients contract', () => {
  beforeEach(() => {
    kcadmMock.calls = [];
    configureScenario();
    process.env.KEYCLOAK_PROVISIONER_BASE_URL = 'https://keycloak.example.test';
    process.env.KEYCLOAK_PROVISIONER_REALM = 'root-realm';
    process.env.KEYCLOAK_PROVISIONER_CLIENT_ID = 'provisioner';
  });

  it('preserves all fourteen successful and advisory check results without exposing secrets', async () => {
    const result = await inspectRealmAndClients(target, {
      authSecret: loginSecretMarker,
      tenantAdminSecret: tenantAdminSecretMarker,
    });

    expect(result.checks).toEqual([
      {
        checkId: 'keycloak.realm.exists',
        status: 'pass',
        summary: 'tenant-realm',
        title: 'Tenant-Realm existiert',
      },
      {
        checkId: 'keycloak.client.login.exists',
        status: 'pass',
        summary: 'studio-login',
        title: 'Login-Client existiert',
      },
      {
        checkId: 'keycloak.client.login.urls',
        details: {
          actualPostLogoutRedirectUris: ['+', 'https://tenant.studio.example.test/'],
          actualRedirectUris: ['https://tenant.studio.example.test/auth/callback'],
          actualRootUrl: 'https://tenant.studio.example.test',
          actualWebOrigins: ['https://tenant.studio.example.test'],
        },
        status: 'pass',
        summary: 'tenant.studio.example.test',
        title: 'Login-Client-URLs stimmen exakt',
      },
      {
        checkId: 'secrets.login.aligned',
        status: 'pass',
        summary: 'tenant secret compared',
        title: 'Login-Client-Secret ist aligned',
      },
      {
        checkId: 'keycloak.client.tenant_admin.exists',
        status: 'pass',
        summary: 'tenant-admin',
        title: 'Tenant-Admin-Client existiert',
      },
      {
        checkId: 'keycloak.client.tenant_admin.flags',
        details: {
          directAccessGrantsEnabled: false,
          serviceAccountsEnabled: true,
          standardFlowEnabled: false,
        },
        status: 'pass',
        summary: 'tenant-admin',
        title: 'Tenant-Admin-Client-Flags stimmen',
      },
      {
        checkId: 'secrets.tenant_admin.aligned',
        status: 'pass',
        summary: 'tenant admin secret compared',
        title: 'Tenant-Admin-Client-Secret ist aligned',
      },
      {
        checkId: 'keycloak.client.tenant_admin.roles',
        details: {
          assignedRoles: [
            'manage-users',
            'view-users',
            'view-realm',
            'manage-realm',
            'manage-clients',
          ],
        },
        status: 'pass',
        summary: 'tenant-admin',
        title: 'Tenant-Admin-Serviceaccount hat realm-management-Rollen',
      },
      {
        checkId: 'keycloak.role.system_admin.exists',
        status: 'pass',
        summary: 'system_admin',
        title: 'Realm-Rolle system_admin existiert',
      },
      {
        checkId: 'keycloak.user.system_admin.exists',
        details: { username: 'system-admin' },
        status: 'pass',
        summary: 'system-admin',
        title: 'Aktiver system_admin-User existiert',
      },
      {
        checkId: 'keycloak.user.system_admin.not_instance_registry_admin',
        details: { roles: ['system_admin'] },
        status: 'pass',
        summary: 'role set inspected',
        title: 'system_admin-User trägt nicht instance_registry_admin',
      },
      {
        checkId: 'tenant_iam.access',
        details: {
          assignedRoles: [
            'manage-users',
            'view-users',
            'view-realm',
            'manage-realm',
            'manage-clients',
          ],
        },
        status: 'pass',
        summary: 'tenant-admin',
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
        status: 'pass',
        summary: 'bootstrap-admin',
        title: 'Bootstrap-Admin-Stammdaten sind gepflegt',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(loginSecretMarker);
    expect(JSON.stringify(result)).not.toContain(tenantAdminSecretMarker);
    expect(existsSync(readConfigPath())).toBe(false);
  });

  it('preserves the read-only kcadm command order and config cleanup', async () => {
    await inspectRealmAndClients(target, {
      authSecret: loginSecretMarker,
      tenantAdminSecret: tenantAdminSecretMarker,
    });

    expect(kcadmMock.calls.map(commandKey)).toEqual([
      'config credentials',
      'get realms/tenant-realm',
      'get clients -r tenant-realm -q clientId=studio-login',
      'get clients/login-internal-id/client-secret -r tenant-realm',
      'get clients -r tenant-realm -q clientId=tenant-admin',
      'get clients/tenant-admin-internal-id/client-secret -r tenant-realm',
      'get roles -r tenant-realm',
      'get roles/system_admin/users -r tenant-realm',
      'get users/system-admin-user-id/role-mappings/realm -r tenant-realm',
      'get clients -r tenant-realm -q clientId=tenant-admin',
      'get clients -r tenant-realm -q clientId=realm-management',
      'get clients/tenant-admin-internal-id/service-account-user -r tenant-realm',
      'get users/tenant-admin-service-user-id/role-mappings/clients/realm-management-id -r tenant-realm',
    ]);
    expect(existsSync(readConfigPath())).toBe(false);
  });

  it('returns only the established realm failure and still cleans up', async () => {
    configureScenario({ realmExists: false });

    await expect(inspectRealmAndClients(target)).resolves.toEqual({
      checks: [
        {
          checkId: 'keycloak.realm.exists',
          status: 'fail',
          summary: 'realm missing',
          title: 'Tenant-Realm existiert',
        },
      ],
    });
    expect(kcadmMock.calls.map(commandKey)).toEqual([
      'config credentials',
      'get realms/tenant-realm',
    ]);
    expect(existsSync(readConfigPath())).toBe(false);
  });

  it('preserves fail statuses for URL, secret, tenant-admin flag, and role drift', async () => {
    configureScenario({
      loginClient: {
        attributes: { 'post.logout.redirect.uris': 'https://wrong.example.test/' },
        clientId: 'studio-login',
        id: 'login-internal-id',
        redirectUris: ['https://wrong.example.test/auth/callback'],
        rootUrl: 'https://wrong.example.test',
        webOrigins: ['https://wrong.example.test'],
      },
      loginSecret: 'synthetic-other-login-secret',
      tenantAdminClient: {
        clientId: 'tenant-admin',
        directAccessGrantsEnabled: true,
        id: 'tenant-admin-internal-id',
        serviceAccountsEnabled: false,
        standardFlowEnabled: true,
      },
      tenantAdminSecret: null,
      tenantAdminServiceRoles: ['view-users'],
      systemAdminRoles: ['system_admin', 'instance_registry_admin'],
    });

    const result = await inspectRealmAndClients(target, {
      authSecret: loginSecretMarker,
      tenantAdminSecret: tenantAdminSecretMarker,
    });
    const byId = new Map(result.checks.map((check) => [check.checkId, check]));

    expect(byId.get('keycloak.client.login.urls')).toMatchObject({ status: 'fail' });
    expect(byId.get('secrets.login.aligned')).toEqual({
      checkId: 'secrets.login.aligned',
      status: 'fail',
      summary: 'tenant secret compared',
      title: 'Login-Client-Secret ist aligned',
    });
    expect(byId.get('keycloak.client.tenant_admin.flags')).toMatchObject({ status: 'fail' });
    expect(byId.get('secrets.tenant_admin.aligned')).toMatchObject({
      status: 'fail',
      summary: 'secret missing',
    });
    expect(byId.get('keycloak.client.tenant_admin.roles')).toMatchObject({ status: 'fail' });
    expect(byId.get('tenant_iam.access')).toMatchObject({ status: 'fail' });
    expect(byId.get('keycloak.user.system_admin.not_instance_registry_admin')).toMatchObject({
      status: 'fail',
    });
  });

  it('preserves missing-client failures without attempting client-secret reads', async () => {
    configureScenario({ loginClient: null, tenantAdminClient: null });

    const result = await inspectRealmAndClients(target, {
      authSecret: loginSecretMarker,
      tenantAdminSecret: tenantAdminSecretMarker,
    });
    const byId = new Map(result.checks.map((check) => [check.checkId, check]));

    expect(byId.get('keycloak.client.login.exists')).toMatchObject({ status: 'fail' });
    expect(byId.get('keycloak.client.login.urls')).toMatchObject({
      details: {
        actualPostLogoutRedirectUris: [],
        actualRedirectUris: [],
        actualRootUrl: undefined,
        actualWebOrigins: [],
      },
      status: 'fail',
    });
    expect(byId.get('secrets.login.aligned')).toMatchObject({
      status: 'fail',
      summary: 'secret missing',
    });
    expect(byId.get('keycloak.client.tenant_admin.exists')).toMatchObject({ status: 'fail' });
    expect(byId.get('keycloak.client.tenant_admin.flags')).toMatchObject({ status: 'fail' });
    expect(byId.get('secrets.tenant_admin.aligned')).toMatchObject({
      status: 'fail',
      summary: 'secret missing',
    });
    expect(kcadmMock.calls.map(commandKey)).not.toContain(
      'get clients/login-internal-id/client-secret -r tenant-realm'
    );
    expect(kcadmMock.calls.map(commandKey)).not.toContain(
      'get clients/tenant-admin-internal-id/client-secret -r tenant-realm'
    );
  });

  it('preserves the system-admin skip and optional warning semantics', async () => {
    configureScenario({ realmRoles: ['viewer'], systemAdminUser: null });

    const result = await inspectRealmAndClients(
      { ...target, tenantAdminUsername: undefined },
      { authSecret: loginSecretMarker, tenantAdminSecret: tenantAdminSecretMarker }
    );
    const byId = new Map(result.checks.map((check) => [check.checkId, check]));

    expect(byId.get('keycloak.role.system_admin.exists')).toMatchObject({ status: 'fail' });
    expect(byId.get('keycloak.user.system_admin.exists')).toMatchObject({
      status: 'fail',
      summary: 'no active system_admin user',
    });
    expect(byId.get('keycloak.user.system_admin.not_instance_registry_admin')).toEqual({
      checkId: 'keycloak.user.system_admin.not_instance_registry_admin',
      details: { roles: [] },
      status: 'skip',
      summary: 'no system_admin user',
      title: 'system_admin-User trägt nicht instance_registry_admin',
    });
    expect(byId.get('keycloak.mapper.instance_id')).toMatchObject({ status: 'warn' });
    expect(byId.get('keycloak.bootstrap_user.profile')).toMatchObject({
      status: 'warn',
      summary: 'bootstrap user missing',
    });
  });
});
