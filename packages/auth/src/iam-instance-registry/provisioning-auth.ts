import { createSdkLogger } from '@sva/sdk/server';
import { KeycloakAdminClient, getKeycloakAdminClientConfigFromEnv } from '../keycloak-admin-client.js';

import type { KeycloakTenantStatus } from './types.js';

const logger = createSdkLogger({ component: 'iam-instance-registry', level: 'info' });
const INSTANCE_ID_MAPPER_NAME = 'instanceId';

const resolveProtocol = (): string => {
  const baseUrl = process.env.SVA_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return 'https';
  }

  try {
    return new URL(baseUrl).protocol.replace(':', '') || 'https';
  } catch {
    return 'https';
  }
};

const buildOrigin = (primaryHostname: string): string => `${resolveProtocol()}://${primaryHostname}`;

const buildExpectedClientConfig = (primaryHostname: string) => {
  const origin = buildOrigin(primaryHostname);
  return {
    rootUrl: origin,
    redirectUris: [`${origin}/auth/callback`],
    postLogoutRedirectUris: [`${origin}/`, '+'],
    webOrigins: [origin],
  };
};

const toSortedUnique = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );

const equalSets = (left: readonly string[], right: readonly string[]): boolean => {
  const normalizedLeft = toSortedUnique(left);
  const normalizedRight = toSortedUnique(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const readPostLogoutUris = (attributes: Readonly<Record<string, string>> | undefined): readonly string[] => {
  const value = attributes?.['post.logout.redirect.uris'];
  if (!value) {
    return [];
  }
  return value
    .split('##')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const ensureTenantAdmin = async (client: KeycloakAdminClient, input: {
  instanceId: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword?: string;
}): Promise<void> => {
  const fallbackEmail = `${input.username}@tenant.invalid`;
  const resolvedEmail = input.email ?? fallbackEmail;

  await client.ensureRealmRole('system_admin');
  await client.ensureRealmRole('instance_registry_admin');

  const existing = await client.findUserByUsername(input.username);
  if (!existing) {
    const created = await client.createUser({
      username: input.username,
      email: resolvedEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
      attributes: {
        instanceId: [input.instanceId],
      },
    });
    await client.syncRoles(created.externalId, ['system_admin']);
    if (input.temporaryPassword) {
      await client.setUserPassword(created.externalId, input.temporaryPassword, true);
      await client.setUserRequiredActions(created.externalId, ['UPDATE_PASSWORD']);
    }
    return;
  }

  await client.updateUser(existing.id, {
    username: input.username,
    email: input.email ?? existing.email ?? fallbackEmail,
    firstName: input.firstName,
    lastName: input.lastName,
    enabled: existing.enabled ?? true,
    attributes: {
      ...(existing.attributes ?? {}),
      instanceId: [input.instanceId],
    },
  });
  await client.syncRoles(existing.id, ['system_admin']);
  if (input.temporaryPassword) {
    await client.setUserPassword(existing.id, input.temporaryPassword, true);
    await client.setUserRequiredActions(existing.id, ['UPDATE_PASSWORD']);
  }
};

const buildMissingRealmStatus = (
  authClientSecretConfigured: boolean,
  authClientSecret?: string
): KeycloakTenantStatus => ({
  realmExists: false,
  clientExists: false,
  instanceIdMapperExists: false,
  tenantAdminExists: false,
  tenantAdminHasSystemAdmin: false,
  tenantAdminHasInstanceRegistryAdmin: false,
  redirectUrisMatch: false,
  logoutUrisMatch: false,
  webOriginsMatch: false,
  clientSecretConfigured: authClientSecretConfigured,
  tenantClientSecretReadable: Boolean(authClientSecret),
  clientSecretAligned: false,
  runtimeSecretSource: authClientSecret ? 'tenant' : 'global',
});

const readTenantAdminStatus = async (
  client: KeycloakAdminClient,
  username: string | undefined
): Promise<{ tenantAdminExists: boolean; tenantAdminHasSystemAdmin: boolean; tenantAdminHasInstanceRegistryAdmin: boolean }> => {
  if (!username) {
    return {
      tenantAdminExists: false,
      tenantAdminHasSystemAdmin: false,
      tenantAdminHasInstanceRegistryAdmin: false,
    };
  }

  const tenantAdmin = await client.findUserByUsername(username);
  const tenantAdminRoles = tenantAdmin ? await client.listUserRoleNames(tenantAdmin.id) : [];
  return {
    tenantAdminExists: Boolean(tenantAdmin),
    tenantAdminHasSystemAdmin: tenantAdminRoles.includes('system_admin'),
    tenantAdminHasInstanceRegistryAdmin: tenantAdminRoles.includes('instance_registry_admin'),
  };
};

export const provisionInstanceAuthArtifacts = async (input: {
  instanceId: string;
  primaryHostname: string;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecret?: string;
  tenantAdminBootstrap?: {
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  tenantAdminTemporaryPassword?: string;
  rotateClientSecret?: boolean;
}): Promise<void> => {
  const client = new KeycloakAdminClient(getKeycloakAdminClientConfigFromEnv(input.authRealm));
  const expectedClient = buildExpectedClientConfig(input.primaryHostname);

  await client.ensureRealm({ displayName: input.instanceId });
  await client.ensureOidcClient({
    clientId: input.authClientId,
    redirectUris: expectedClient.redirectUris,
    postLogoutRedirectUris: expectedClient.postLogoutRedirectUris,
    webOrigins: expectedClient.webOrigins,
    rootUrl: expectedClient.rootUrl,
    clientSecret: input.authClientSecret,
  });
  await client.ensureUserAttributeProtocolMapper({
    clientId: input.authClientId,
    name: INSTANCE_ID_MAPPER_NAME,
    userAttribute: INSTANCE_ID_MAPPER_NAME,
    claimName: INSTANCE_ID_MAPPER_NAME,
  });

  if (input.tenantAdminBootstrap) {
    await ensureTenantAdmin(client, {
      instanceId: input.instanceId,
      ...input.tenantAdminBootstrap,
      temporaryPassword: input.tenantAdminTemporaryPassword,
    });
  }
};

export const getInstanceKeycloakStatus = async (input: {
  instanceId: string;
  primaryHostname: string;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminBootstrap?: {
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}): Promise<KeycloakTenantStatus> => {
  const client = new KeycloakAdminClient(getKeycloakAdminClientConfigFromEnv(input.authRealm));
  const expectedClient = buildExpectedClientConfig(input.primaryHostname);

  const realm = await client.getRealm();
  if (!realm) {
    return buildMissingRealmStatus(input.authClientSecretConfigured, input.authClientSecret);
  }

  const clientRepresentation = await client.getOidcClientByClientId(input.authClientId);
  const protocolMappers = clientRepresentation
    ? await client.listClientProtocolMappers(input.authClientId)
    : [];
  const tenantAdminStatus = await readTenantAdminStatus(client, input.tenantAdminBootstrap?.username);
  const keycloakClientSecret = clientRepresentation ? await client.getOidcClientSecretValue(input.authClientId) : null;
  const clientSecretAligned = Boolean(
    input.authClientSecret && keycloakClientSecret && input.authClientSecret === keycloakClientSecret
  );
  const status: KeycloakTenantStatus = {
    realmExists: true,
    clientExists: Boolean(clientRepresentation),
    instanceIdMapperExists: protocolMappers.some((mapper) => mapper.name === INSTANCE_ID_MAPPER_NAME),
    ...tenantAdminStatus,
    redirectUrisMatch: equalSets(clientRepresentation?.redirectUris ?? [], expectedClient.redirectUris),
    logoutUrisMatch: equalSets(readPostLogoutUris(clientRepresentation?.attributes), expectedClient.postLogoutRedirectUris),
    webOriginsMatch: equalSets(clientRepresentation?.webOrigins ?? [], expectedClient.webOrigins),
    clientSecretConfigured: input.authClientSecretConfigured,
    tenantClientSecretReadable: Boolean(input.authClientSecret),
    clientSecretAligned,
    runtimeSecretSource: input.authClientSecret ? 'tenant' : 'global',
  };

  logger.info('keycloak_reconcile_summary', {
    operation: 'keycloak_tenant_status',
    instance_id: input.instanceId,
    auth_realm: input.authRealm,
    client_id: input.authClientId,
    realm_exists: status.realmExists,
    client_exists: status.clientExists,
    mapper_exists: status.instanceIdMapperExists,
    admin_exists: status.tenantAdminExists,
    roles_ok: status.tenantAdminHasSystemAdmin && !status.tenantAdminHasInstanceRegistryAdmin,
    secret_aligned: status.clientSecretAligned,
    runtime_secret_source: status.runtimeSecretSource,
  });

  return status;
};
