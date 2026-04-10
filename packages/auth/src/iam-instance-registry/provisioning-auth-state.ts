import {
  KeycloakAdminClient,
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
  getKeycloakAdminClientConfigFromEnv,
  getKeycloakProvisionerClientConfigFromEnv,
  type KeycloakAdminClientConfig,
} from '../keycloak-admin-client.js';
import type { KeycloakProvisioningInput, KeycloakReadState, TenantAdminBootstrap, TenantAdminStatus } from './provisioning-auth-types.js';
import {
  buildExpectedClientConfig,
  INSTANCE_ID_MAPPER_NAME,
  INSTANCE_REGISTRY_ADMIN_ROLE,
  SYSTEM_ADMIN_ROLE,
} from './provisioning-auth-utils.js';

type KeycloakClientConfigResolver = (realm?: string) => KeycloakAdminClientConfig;

export const readKeycloakAccessError = (error: unknown): string => {
  if (error instanceof KeycloakAdminUnavailableError) {
    return error.message;
  }
  if (error instanceof KeycloakAdminRequestError) {
    return `HTTP ${error.statusCode} ${error.code}`;
  }
  return error instanceof Error ? error.message : String(error);
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

  await client.ensureRealmRole(SYSTEM_ADMIN_ROLE);
  await client.ensureRealmRole(INSTANCE_REGISTRY_ADMIN_ROLE);

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
    await client.syncRoles(created.externalId, [SYSTEM_ADMIN_ROLE]);
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
  await client.syncRoles(existing.id, [SYSTEM_ADMIN_ROLE]);
  if (input.temporaryPassword) {
    await client.setUserPassword(existing.id, input.temporaryPassword, true);
    await client.setUserRequiredActions(existing.id, ['UPDATE_PASSWORD']);
  }
};

const readTenantAdminStatus = async (
  client: KeycloakAdminClient,
  username: string | undefined
): Promise<TenantAdminStatus> => {
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
    tenantAdminHasSystemAdmin: tenantAdminRoles.includes(SYSTEM_ADMIN_ROLE),
    tenantAdminHasInstanceRegistryAdmin: tenantAdminRoles.includes(INSTANCE_REGISTRY_ADMIN_ROLE),
  };
};

const readKeycloakStateWithResolver = async (
  input: KeycloakProvisioningInput,
  resolveConfig: KeycloakClientConfigResolver
): Promise<KeycloakReadState> => {
  const client = new KeycloakAdminClient(resolveConfig(input.authRealm));
  const expectedClient = buildExpectedClientConfig(input.primaryHostname);
  const realm = await client.getRealm();

  if (!realm) {
    return {
      client,
      expectedClient,
      realm,
      clientRepresentation: null,
      protocolMappers: [],
      tenantAdminStatus: {
        tenantAdminExists: false,
        tenantAdminHasSystemAdmin: false,
        tenantAdminHasInstanceRegistryAdmin: false,
      },
      keycloakClientSecret: null,
      systemAdminRole: null,
      instanceRegistryAdminRole: null,
    };
  }

  const clientRepresentation = await client.getOidcClientByClientId(input.authClientId);
  const protocolMappers = clientRepresentation ? await client.listClientProtocolMappers(input.authClientId) : [];
  const tenantAdminStatus = await readTenantAdminStatus(client, input.tenantAdminBootstrap?.username);
  const keycloakClientSecret = clientRepresentation ? await client.getOidcClientSecretValue(input.authClientId) : null;
  const [systemAdminRole, instanceRegistryAdminRole] = await Promise.all([
    client.getRoleByName(SYSTEM_ADMIN_ROLE),
    client.getRoleByName(INSTANCE_REGISTRY_ADMIN_ROLE),
  ]);

  return {
    client,
    expectedClient,
    realm,
    clientRepresentation,
    protocolMappers,
    tenantAdminStatus,
    keycloakClientSecret,
    systemAdminRole,
    instanceRegistryAdminRole,
  };
};

export const readKeycloakState = async (input: KeycloakProvisioningInput): Promise<KeycloakReadState> =>
  readKeycloakStateWithResolver(input, getKeycloakAdminClientConfigFromEnv);

export const readKeycloakStateViaProvisioner = async (input: KeycloakProvisioningInput): Promise<KeycloakReadState> =>
  readKeycloakStateWithResolver(input, getKeycloakProvisionerClientConfigFromEnv);

const provisionInstanceAuthArtifactsWithResolver = async (
  input: {
  instanceId: string;
  primaryHostname: string;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
  tenantAdminTemporaryPassword?: string;
  rotateClientSecret?: boolean;
},
  resolveConfig: KeycloakClientConfigResolver
): Promise<void> => {
  const client = new KeycloakAdminClient(resolveConfig(input.authRealm));
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

export const provisionInstanceAuthArtifacts = async (input: {
  instanceId: string;
  primaryHostname: string;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
  tenantAdminTemporaryPassword?: string;
  rotateClientSecret?: boolean;
}): Promise<void> => provisionInstanceAuthArtifactsWithResolver(input, getKeycloakAdminClientConfigFromEnv);

export const provisionInstanceAuthArtifactsViaProvisioner = async (input: {
  instanceId: string;
  primaryHostname: string;
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
  tenantAdminTemporaryPassword?: string;
  rotateClientSecret?: boolean;
}): Promise<void> => provisionInstanceAuthArtifactsWithResolver(input, getKeycloakProvisionerClientConfigFromEnv);
