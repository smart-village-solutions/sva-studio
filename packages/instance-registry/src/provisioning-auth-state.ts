import type {
  KeycloakClientRepresentation,
  KeycloakProvisioningInput,
  KeycloakReadState,
  KeycloakRoleRepresentation,
  TenantAdminBootstrap,
  TenantAdminStatus,
} from './provisioning-auth-types.js';
import {
  buildExpectedClientConfig,
  buildExpectedTenantAdminClientConfig,
  INSTANCE_ID_MAPPER_NAME,
  INSTANCE_REGISTRY_ADMIN_ROLE,
  SYSTEM_ADMIN_ROLE,
} from './provisioning-auth-utils.js';

type KeycloakAdminUser = {
  readonly id: string;
  readonly username?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly enabled?: boolean;
  readonly attributes?: Readonly<Record<string, readonly string[]>>;
};

export type KeycloakProvisioningClient = {
  ensureRealm(input: { displayName?: string }): Promise<void>;
  getRealm(): Promise<{ realm: string } | null>;
  getOidcClientByClientId(clientId: string): Promise<KeycloakClientRepresentation>;
  getOidcClientSecretValue(clientId: string): Promise<string | null>;
  ensureOidcClient(input: {
    clientId: string;
    redirectUris: readonly string[];
    postLogoutRedirectUris: readonly string[];
    webOrigins: readonly string[];
    rootUrl: string;
    clientSecret?: string;
    rotateClientSecret?: boolean;
    standardFlowEnabled?: boolean;
    directAccessGrantsEnabled?: boolean;
    serviceAccountsEnabled?: boolean;
  }): Promise<void>;
  listClientProtocolMappers(clientId: string): Promise<readonly { name: string }[]>;
  ensureUserAttributeProtocolMapper(input: {
    clientId: string;
    name: string;
    userAttribute: string;
    claimName: string;
  }): Promise<void>;
  ensureRealmRole(externalName: string): Promise<void>;
  getRoleByName(externalName: string): Promise<KeycloakRoleRepresentation>;
  findUserByUsername(username: string): Promise<KeycloakAdminUser | null>;
  findUserByEmail(email: string): Promise<KeycloakAdminUser | null>;
  createUser(input: {
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
    attributes?: Readonly<Record<string, readonly string[]>>;
  }): Promise<{ externalId: string }>;
  updateUser(
    externalId: string,
    input: {
      username: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      enabled: boolean;
      attributes?: Readonly<Record<string, readonly string[]>>;
    }
  ): Promise<unknown>;
  syncRoles(externalId: string, roles: readonly string[]): Promise<void>;
  setUserPassword(externalId: string, password: string, temporary?: boolean): Promise<void>;
  setUserRequiredActions(externalId: string, requiredActions: readonly string[]): Promise<void>;
  listUserRoleNames(externalId: string): Promise<readonly string[]>;
};

export type KeycloakProvisioningClientFactory = (realm?: string) => KeycloakProvisioningClient;

type TenantAdminInput = {
  instanceId: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword?: string;
};
type ProvisionInstanceAuthArtifactsInput = {
  instanceId: string;
  primaryHostname: string;
  realmMode: 'new' | 'existing';
  authRealm: string;
  authClientId: string;
  authIssuerUrl?: string;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured?: boolean;
  };
  tenantAdminClientSecret?: string;
  tenantAdminBootstrap?: TenantAdminBootstrap;
  tenantAdminTemporaryPassword?: string;
  rotateClientSecret?: boolean;
};

const isConflictRequestError = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'statusCode' in error
  && (error as { readonly statusCode?: unknown }).statusCode === 409;

const ensureTenantAdmin = async (client: KeycloakProvisioningClient, input: TenantAdminInput): Promise<void> => {
  const syncTenantAdminAccess = async (userId: string) => {
    await client.syncRoles(userId, [SYSTEM_ADMIN_ROLE]);
    if (!input.temporaryPassword) {
      return;
    }
    await client.setUserPassword(userId, input.temporaryPassword, true);
    await client.setUserRequiredActions(userId, ['UPDATE_PASSWORD']);
  };

  const buildAttributes = (attributes?: Readonly<Record<string, readonly string[]>>) => ({
    ...Object.fromEntries(
      Object.entries(attributes ?? {}).map(([key, value]) => [key, [...value]])
    ),
    instanceId: [input.instanceId],
  });

  const updateExisting = async (user: {
    id: string;
    email?: string;
    enabled?: boolean;
    attributes?: Readonly<Record<string, readonly string[]>>;
  }) => {
    await client.updateUser(user.id, {
      username: input.username,
      email: input.email ?? user.email ?? fallbackEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: user.enabled ?? true,
      attributes: buildAttributes(user.attributes),
    });
    await syncTenantAdminAccess(user.id);
  };

  const fallbackEmail = `${input.username}@tenant.invalid`;
  const resolvedEmail = input.email ?? fallbackEmail;

  await client.ensureRealmRole(SYSTEM_ADMIN_ROLE);
  await client.ensureRealmRole(INSTANCE_REGISTRY_ADMIN_ROLE);

  const existing = (await client.findUserByUsername(input.username))
    ?? (resolvedEmail ? await client.findUserByEmail(resolvedEmail) : null);
  if (!existing) {
    try {
      const created = await client.createUser({
        username: input.username,
        email: resolvedEmail,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        attributes: buildAttributes(),
      });
      await syncTenantAdminAccess(created.externalId);
      return;
    } catch (error) {
      if (!isConflictRequestError(error)) {
        throw error;
      }

      const conflictingUser = await client.findUserByEmail(resolvedEmail);
      if (!conflictingUser) {
        throw error;
      }

      await updateExisting({
        id: conflictingUser.id,
        email: resolvedEmail,
        enabled: conflictingUser.enabled,
        attributes: conflictingUser.attributes,
      });
      return;
    }
  }
  await updateExisting(existing);
};

const readTenantAdminStatus = async (
  client: KeycloakProvisioningClient,
  input: {
    username: string | undefined;
    instanceId: string;
  }
): Promise<TenantAdminStatus> => {
  if (!input.username) {
    return {
      tenantAdminExists: false,
      tenantAdminHasSystemAdmin: false,
      tenantAdminHasInstanceRegistryAdmin: false,
      tenantAdminInstanceIdMatches: false,
    };
  }

  const tenantAdmin = await client.findUserByUsername(input.username);
  const tenantAdminRoles = tenantAdmin ? await client.listUserRoleNames(tenantAdmin.id) : [];
  const tenantAdminInstanceIds = tenantAdmin?.attributes?.instanceId ?? [];
  return {
    tenantAdminExists: Boolean(tenantAdmin),
    tenantAdminHasSystemAdmin: tenantAdminRoles.includes(SYSTEM_ADMIN_ROLE),
    tenantAdminHasInstanceRegistryAdmin: tenantAdminRoles.includes(INSTANCE_REGISTRY_ADMIN_ROLE),
    tenantAdminInstanceIdMatches: tenantAdminInstanceIds.includes(input.instanceId),
  };
};

export const createReadKeycloakState =
  (createClient: KeycloakProvisioningClientFactory) =>
  async (
    input: KeycloakProvisioningInput,
  ): Promise<KeycloakReadState> => {
    const client = createClient(input.authRealm);
    const expectedClient = buildExpectedClientConfig(input.primaryHostname);
    const expectedTenantAdminClient = input.tenantAdminClient
      ? buildExpectedTenantAdminClientConfig(input.primaryHostname)
      : null;
    const realm = await client.getRealm();

    if (!realm) {
      return {
        client,
        expectedClient,
        expectedTenantAdminClient,
        realm,
        clientRepresentation: null,
        tenantAdminClientRepresentation: null,
        protocolMappers: [],
        tenantAdminStatus: {
          tenantAdminExists: false,
          tenantAdminHasSystemAdmin: false,
          tenantAdminHasInstanceRegistryAdmin: false,
          tenantAdminInstanceIdMatches: false,
        },
        keycloakClientSecret: null,
        tenantAdminClientSecret: null,
        systemAdminRole: null,
        instanceRegistryAdminRole: null,
      };
    }

    const clientRepresentation = await client.getOidcClientByClientId(input.authClientId);
    const tenantAdminClientRepresentation = input.tenantAdminClient?.clientId
      ? await client.getOidcClientByClientId(input.tenantAdminClient.clientId)
      : null;
    const protocolMappers = clientRepresentation ? await client.listClientProtocolMappers(input.authClientId) : [];
    const tenantAdminStatus = await readTenantAdminStatus(client, {
      username: input.tenantAdminBootstrap?.username,
      instanceId: input.instanceId,
    });
    const keycloakClientSecret = clientRepresentation ? await client.getOidcClientSecretValue(input.authClientId) : null;
    const tenantAdminClientSecret = input.tenantAdminClient?.clientId
      ? await client.getOidcClientSecretValue(input.tenantAdminClient.clientId)
      : null;
    const [systemAdminRole, instanceRegistryAdminRole] = await Promise.all([
      client.getRoleByName(SYSTEM_ADMIN_ROLE),
      client.getRoleByName(INSTANCE_REGISTRY_ADMIN_ROLE),
    ]);

    return {
      client,
      expectedClient,
      expectedTenantAdminClient,
      realm,
      clientRepresentation,
      tenantAdminClientRepresentation,
      protocolMappers,
      tenantAdminStatus,
      keycloakClientSecret,
      tenantAdminClientSecret,
      systemAdminRole,
      instanceRegistryAdminRole,
    };
  };

export const createProvisionInstanceAuthArtifacts =
  (createClient: KeycloakProvisioningClientFactory) =>
  async (
    input: ProvisionInstanceAuthArtifactsInput,
  ): Promise<void> => {
    const client = createClient(input.authRealm);
    const expectedClient = buildExpectedClientConfig(input.primaryHostname);

    if (input.realmMode === 'new') {
      await client.ensureRealm({ displayName: input.instanceId });
    } else {
      const realm = await client.getRealm();
      if (!realm) {
        throw new Error(`Keycloak realm ${input.authRealm} does not exist`);
      }
    }
    await client.ensureOidcClient({
      clientId: input.authClientId,
      redirectUris: expectedClient.redirectUris,
      postLogoutRedirectUris: expectedClient.postLogoutRedirectUris,
      webOrigins: expectedClient.webOrigins,
      rootUrl: expectedClient.rootUrl,
      clientSecret: input.authClientSecret,
      rotateClientSecret: input.rotateClientSecret,
    });

    if (input.tenantAdminClient?.clientId) {
      const expectedTenantAdminClient = buildExpectedTenantAdminClientConfig(input.primaryHostname);
      await client.ensureOidcClient({
        clientId: input.tenantAdminClient.clientId,
        redirectUris: expectedTenantAdminClient.redirectUris,
        postLogoutRedirectUris: expectedTenantAdminClient.postLogoutRedirectUris,
        webOrigins: expectedTenantAdminClient.webOrigins,
        rootUrl: expectedTenantAdminClient.rootUrl,
        clientSecret: input.tenantAdminClientSecret,
        standardFlowEnabled: expectedTenantAdminClient.standardFlowEnabled,
        directAccessGrantsEnabled: expectedTenantAdminClient.directAccessGrantsEnabled,
        serviceAccountsEnabled: expectedTenantAdminClient.serviceAccountsEnabled,
      });
    }
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
