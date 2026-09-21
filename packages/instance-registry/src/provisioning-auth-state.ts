import { createSdkLogger } from '@sva/server-runtime';

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
  SYSTEM_ADMIN_ROLE,
} from './provisioning-auth-utils.js';
import {
  STUDIO_OWNERSHIP_ATTRIBUTES,
  readStudioOwnedClient,
  readStudioOwnedUser,
} from './provisioning-auth-policy.js';
import {
  readPluginOidcClientAlignment,
  readPluginOidcClientRequirements,
} from './provisioning-auth-plugin-clients.js';
import {
  isKeycloakRealmBaselineAligned,
  KEYCLOAK_REALM_BASELINE,
  type KeycloakRealmBaselineSettings,
} from './keycloak-realm-baseline.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

const rethrowAfterSuccessfulRealmCleanup = (error: unknown): never => {
  if (
    !(error instanceof Error) ||
    !error.message.includes(
      'strict_oidc_client_reconciliation_failed_cleanup_failed_requires_manual_action'
    )
  ) {
    throw error;
  }
  const compensatedError = new Error(
    'plugin_oidc_client_reconciliation_failed_compensated_by_realm_cleanup'
  ) as Error & { cause?: unknown };
  compensatedError.cause = error;
  throw compensatedError;
};

export {
  readPluginOidcClientAlignment,
  readPluginOidcClientRequirements,
} from './provisioning-auth-plugin-clients.js';

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
  listRealms(): Promise<readonly { readonly realm: string }[]>;
  hasRealmCreateCapability(): Promise<boolean>;
  ensureRealm(input: {
    displayName?: string;
    settings?: KeycloakRealmBaselineSettings;
  }): Promise<boolean>;
  deleteRealm(): Promise<void>;
  getRealm(): Promise<KeycloakReadState['realm']>;
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
    implicitFlowEnabled?: boolean;
    directAccessGrantsEnabled?: boolean;
    serviceAccountsEnabled?: boolean;
    enabled?: boolean;
    uriPolicy?: 'merge' | 'replace';
    publicClient?: boolean;
    pkceCodeChallengeMethod?: 'S256';
    accessTokenLifespan?: 900;
    ownership?: Readonly<{ instanceId: string; artifactKey: string }>;
  }): Promise<void>;
  ensureTenantAdminServiceAccess(clientId: string): Promise<void>;
  listClientProtocolMappers(clientId: string): Promise<
    readonly {
      name: string;
      protocol?: string;
      protocolMapper?: string;
      config?: Readonly<Record<string, string>>;
    }[]
  >;
  listEffectiveClientProtocolMappers(clientId: string): Promise<
    readonly {
      name: string;
      protocol?: string;
      protocolMapper?: string;
      config?: Readonly<Record<string, string>>;
    }[]
  >;
  ensureUserAttributeProtocolMapper(input: {
    clientId: string;
    name: string;
    userAttribute: string;
    claimName: string;
  }): Promise<void>;
  ensureAdminOnlyUserProfileAttributes(
    attributes: readonly Readonly<{ name: string; multivalued: boolean }>[]
  ): Promise<void>;
  hasAdminOnlyUserProfileAttributes(
    attributes: readonly Readonly<{ name: string; multivalued: boolean }>[]
  ): Promise<boolean>;
  ensureAudienceProtocolMapper(input: {
    clientId: string;
    name: string;
    audience: string;
  }): Promise<void>;
  ensureRealmRole(
    externalName: string,
    instanceId?: string,
    options?: { readonly allowLegacyRealmRoleMigration?: boolean }
  ): Promise<void>;
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

export type KeycloakProvisioningClientConfigResolver<TConfig> = (realm?: string) => TConfig;

export const createKeycloakProvisioningClientFactory =
  <TConfig>(
    resolveConfig: KeycloakProvisioningClientConfigResolver<TConfig>,
    createClient: (config: TConfig) => KeycloakProvisioningClient
  ): KeycloakProvisioningClientFactory =>
  (realm?: string) =>
    createClient(resolveConfig(realm));

export const createKeycloakProvisioningAdapters = (
  createClient: KeycloakProvisioningClientFactory
) => ({
  listKeycloakRealms: () => createClient().listRealms(),
  readKeycloakRealmCreateCapability: () => createClient().hasRealmCreateCapability(),
  readKeycloakState: createReadKeycloakState(createClient),
  provisionInstanceAuthArtifacts: createProvisionInstanceAuthArtifacts(createClient),
  deleteKeycloakRealm: (realm: string) => createClient(realm).deleteRealm(),
});

type TenantAdminInput = {
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
  allowLegacyRealmRoleMigration?: boolean;
  rotateClientSecret?: boolean;
  reconcileAuthClient?: boolean;
  reconcileTenantAdminClient?: boolean;
  pluginOidcClients?: KeycloakProvisioningInput['pluginOidcClients'];
};

const isConflictRequestError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'statusCode' in error &&
  (error as { readonly statusCode?: unknown }).statusCode === 409;

const ensureTenantAdmin = async (
  client: KeycloakProvisioningClient,
  input: TenantAdminInput & { instanceId: string }
): Promise<void> => {
  const checkpoint = (result: string) =>
    logger.info('tenant_admin_bootstrap_checkpoint', {
      operation: 'ensure_tenant_admin',
      instance_id: input.instanceId,
      result,
    });
  checkpoint('started');
  const ownershipAttributes = {
    [STUDIO_OWNERSHIP_ATTRIBUTES.managedBy]: ['studio'],
    [STUDIO_OWNERSHIP_ATTRIBUTES.instanceId]: [input.instanceId],
    [STUDIO_OWNERSHIP_ATTRIBUTES.artifactKey]: ['tenant_admin'],
  } as const;
  const syncTenantAdminAccess = async (userId: string) => {
    await client.syncRoles(userId, [SYSTEM_ADMIN_ROLE]);
    checkpoint('roles_synced');
    if (!input.temporaryPassword) {
      return;
    }
    await client.setUserPassword(userId, input.temporaryPassword, true);
    await client.setUserRequiredActions(userId, ['UPDATE_PASSWORD']);
  };

  const updateExisting = async (user: KeycloakAdminUser) => {
    if (readStudioOwnedUser(user, input.instanceId, 'tenant_admin') !== 'owned') {
      throw new Error('tenant_admin_ownership_conflict');
    }
    await client.updateUser(user.id, {
      username: input.username,
      email: input.email ?? user.email ?? fallbackEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: user.enabled ?? true,
      attributes: ownershipAttributes,
    });
    await syncTenantAdminAccess(user.id);
    checkpoint('completed');
  };

  const fallbackEmail = `${input.username}@tenant.invalid`;
  const resolvedEmail = input.email ?? fallbackEmail;

  const existing = await client.findUserByUsername(input.username);
  checkpoint(existing ? 'user_found' : 'user_missing');
  if (!existing) {
    try {
      const created = await client.createUser({
        username: input.username,
        email: resolvedEmail,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        attributes: ownershipAttributes,
      });
      checkpoint('user_created');
      await syncTenantAdminAccess(created.externalId);
      checkpoint('completed');
      return;
    } catch (error) {
      if (!isConflictRequestError(error)) {
        throw error;
      }

      const conflictingUser = await client.findUserByUsername(input.username);
      checkpoint(conflictingUser ? 'conflict_user_found' : 'conflict_user_missing');
      if (!conflictingUser) {
        throw error;
      }

      await updateExisting(conflictingUser);
      return;
    }
  }
  await updateExisting(existing);
};

const readTenantAdminStatus = async (
  client: KeycloakProvisioningClient,
  input: {
    username: string | undefined;
  }
): Promise<{ status: TenantAdminStatus; representation: KeycloakAdminUser | null }> => {
  if (!input.username) {
    return {
      status: { tenantAdminExists: false, tenantAdminHasSystemAdmin: false },
      representation: null,
    };
  }

  const tenantAdmin = await client.findUserByUsername(input.username);
  const tenantAdminRoles = tenantAdmin ? await client.listUserRoleNames(tenantAdmin.id) : [];
  return {
    status: {
      tenantAdminExists: Boolean(tenantAdmin),
      tenantAdminHasSystemAdmin: tenantAdminRoles.includes(SYSTEM_ADMIN_ROLE),
    },
    representation: tenantAdmin,
  };
};

// Keep the local creation preview identical to a worker read of an absent realm.
export const buildMissingRealmReadState = (
  input: Pick<KeycloakProvisioningInput, 'primaryHostname' | 'tenantAdminClient'>
): KeycloakReadState => ({
  client: null,
  expectedClient: buildExpectedClientConfig(input.primaryHostname),
  expectedTenantAdminClient: input.tenantAdminClient
    ? buildExpectedTenantAdminClientConfig(input.primaryHostname)
    : null,
  realm: null,
  clientRepresentation: null,
  tenantAdminClientRepresentation: null,
  pluginOidcClients: [],
  protocolMappers: [],
  tenantAdminStatus: { tenantAdminExists: false, tenantAdminHasSystemAdmin: false },
  keycloakClientSecret: null,
  tenantAdminClientSecret: null,
  systemAdminRole: null,
  realmBaselineAligned: false,
  userProfileBaselineAligned: false,
});

export const createReadKeycloakState =
  (createClient: KeycloakProvisioningClientFactory) =>
  async (input: KeycloakProvisioningInput): Promise<KeycloakReadState> => {
    const pluginOidcClientRequirements = readPluginOidcClientRequirements(input);
    const client = createClient(input.authRealm);
    const expectedClient = buildExpectedClientConfig(input.primaryHostname);
    const expectedTenantAdminClient = input.tenantAdminClient
      ? buildExpectedTenantAdminClientConfig(input.primaryHostname)
      : null;
    const realm = await client.getRealm();

    if (!realm) {
      return { ...buildMissingRealmReadState(input), client };
    }

    const clientRepresentation = await client.getOidcClientByClientId(input.authClientId);
    const tenantAdminClientRepresentation = input.tenantAdminClient?.clientId
      ? await client.getOidcClientByClientId(input.tenantAdminClient.clientId)
      : null;
    const pluginOidcClients = await Promise.all(
      pluginOidcClientRequirements.map(async (requirement) => {
        const clientRepresentation = await client.getOidcClientByClientId(requirement.clientId);
        const protocolMappers = clientRepresentation
          ? await client.listClientProtocolMappers(requirement.clientId)
          : [];
        return { requirement, clientRepresentation, protocolMappers };
      })
    );
    const protocolMappers = clientRepresentation
      ? await client.listClientProtocolMappers(input.authClientId)
      : [];
    const tenantAdmin = await readTenantAdminStatus(client, {
      username: input.tenantAdminBootstrap?.username,
    });
    logger.info('tenant_admin_readback', {
      operation: 'read_tenant_admin_status',
      instance_id: input.instanceId,
      bootstrap_configured: Boolean(input.tenantAdminBootstrap?.username),
      user_found: tenantAdmin.status.tenantAdminExists,
      system_admin_assigned: tenantAdmin.status.tenantAdminHasSystemAdmin,
      ownership: readStudioOwnedUser(tenantAdmin.representation, input.instanceId, 'tenant_admin'),
    });
    const keycloakClientSecret =
      clientRepresentation &&
      readStudioOwnedClient(clientRepresentation, input.instanceId, 'login_client') === 'owned'
        ? await client.getOidcClientSecretValue(input.authClientId)
        : null;
    const tenantAdminClientSecret =
      input.tenantAdminClient?.clientId &&
      tenantAdminClientRepresentation &&
      readStudioOwnedClient(
        tenantAdminClientRepresentation,
        input.instanceId,
        'tenant_admin_client'
      ) === 'owned'
        ? await client.getOidcClientSecretValue(input.tenantAdminClient.clientId)
        : null;
    const systemAdminRole = await client.getRoleByName(SYSTEM_ADMIN_ROLE);
    const realmBaselineAligned = isKeycloakRealmBaselineAligned(realm);
    const userProfileBaselineAligned = await client.hasAdminOnlyUserProfileAttributes(
      KEYCLOAK_REALM_BASELINE.userProfileAttributes
    );

    return {
      client,
      expectedClient,
      expectedTenantAdminClient,
      realm,
      clientRepresentation,
      tenantAdminClientRepresentation,
      pluginOidcClients,
      protocolMappers,
      tenantAdminStatus: tenantAdmin.status,
      tenantAdminRepresentation: tenantAdmin.representation,
      keycloakClientSecret,
      tenantAdminClientSecret,
      systemAdminRole,
      realmBaselineAligned,
      userProfileBaselineAligned,
    };
  };

export const createReadKeycloakClientSecrets =
  (createClient: KeycloakProvisioningClientFactory) =>
  async (
    input: KeycloakProvisioningInput
  ): Promise<Pick<KeycloakReadState, 'keycloakClientSecret' | 'tenantAdminClientSecret'>> => {
    const client = createClient(input.authRealm);
    const [keycloakClientSecret, tenantAdminClientSecret] = await Promise.all([
      client.getOidcClientSecretValue(input.authClientId),
      input.tenantAdminClient?.clientId
        ? client.getOidcClientSecretValue(input.tenantAdminClient.clientId)
        : Promise.resolve(null),
    ]);
    return { keycloakClientSecret, tenantAdminClientSecret };
  };

export const reconcilePluginOidcClients = async (
  client: Pick<
    KeycloakProvisioningClient,
    | 'ensureOidcClient'
    | 'ensureAudienceProtocolMapper'
    | 'getOidcClientByClientId'
    | 'listClientProtocolMappers'
  >,
  input: Pick<
    KeycloakProvisioningInput,
    'instanceId' | 'authClientId' | 'tenantAdminClient' | 'pluginOidcClients'
  >
): Promise<void> => {
  for (const requirement of readPluginOidcClientRequirements(input)) {
    const browser = requirement.contractVersion === '2.0';
    const existingClient = browser
      ? await client.getOidcClientByClientId(requirement.clientId)
      : null;
    await client.ensureOidcClient({
      clientId: requirement.clientId,
      redirectUris: browser ? requirement.redirectUris : [],
      postLogoutRedirectUris: [],
      webOrigins: browser ? requirement.webOrigins : [],
      rootUrl: '',
      enabled: browser && existingClient?.enabled === true,
      standardFlowEnabled: browser,
      ...(browser
        ? {
            publicClient: true,
            pkceCodeChallengeMethod: 'S256' as const,
            accessTokenLifespan: 900 as const,
          }
        : {}),
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      uriPolicy: 'replace',
      ownership: {
        instanceId: input.instanceId,
        artifactKey: `plugin_client:${requirement.pluginId}`,
      },
    });
    await client.ensureAudienceProtocolMapper({
      clientId: requirement.clientId,
      name: `studio-${requirement.pluginId}-audience`,
      audience: requirement.audience,
    });
    const clientRepresentation = await client.getOidcClientByClientId(requirement.clientId);
    const protocolMappers = clientRepresentation
      ? await client.listClientProtocolMappers(requirement.clientId)
      : [];
    if (
      !readPluginOidcClientAlignment(requirement, {
        clientRepresentation,
        protocolMappers,
      }).aligned
    ) {
      throw new Error(
        `plugin_oidc_client_readback_failed:${requirement.pluginId}:${requirement.clientId}`
      );
    }
  }
};

const reconcileInstanceAuthArtifacts = async (
  client: KeycloakProvisioningClient,
  input: ProvisionInstanceAuthArtifactsInput,
  pluginOidcClientRequirements: KeycloakProvisioningInput['pluginOidcClients']
): Promise<void> => {
  await reconcilePluginOidcClients(client, {
    ...input,
    pluginOidcClients: pluginOidcClientRequirements,
  });
  if (input.reconcileAuthClient ?? true) {
    const expectedClient = buildExpectedClientConfig(input.primaryHostname);
    await client.ensureOidcClient({
      clientId: input.authClientId,
      redirectUris: expectedClient.redirectUris,
      postLogoutRedirectUris: expectedClient.postLogoutRedirectUris,
      webOrigins: expectedClient.webOrigins,
      rootUrl: expectedClient.rootUrl,
      clientSecret: input.authClientSecret,
      rotateClientSecret: input.rotateClientSecret,
      ownership: { instanceId: input.instanceId, artifactKey: 'login_client' },
    });
    if (input.realmMode === 'new') {
      await client.ensureAdminOnlyUserProfileAttributes(
        KEYCLOAK_REALM_BASELINE.userProfileAttributes
      );
      await client.ensureUserAttributeProtocolMapper({
        clientId: input.authClientId,
        ...KEYCLOAK_REALM_BASELINE.instanceIdMapper,
      });
    }
  }

  if (input.tenantAdminClient?.clientId && (input.reconcileTenantAdminClient ?? true)) {
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
      ownership: { instanceId: input.instanceId, artifactKey: 'tenant_admin_client' },
    });
    await client.ensureTenantAdminServiceAccess(input.tenantAdminClient.clientId);
  }
  await client.ensureRealmRole(SYSTEM_ADMIN_ROLE, input.instanceId, {
    allowLegacyRealmRoleMigration: input.allowLegacyRealmRoleMigration,
  });
  if (!input.tenantAdminBootstrap) {
    logger.info('tenant_admin_bootstrap_checkpoint', {
      operation: 'ensure_tenant_admin',
      instance_id: input.instanceId,
      result: 'skipped_unconfigured',
    });
  }
  if (input.tenantAdminBootstrap) {
    await ensureTenantAdmin(client, {
      ...input.tenantAdminBootstrap,
      instanceId: input.instanceId,
      temporaryPassword: input.tenantAdminTemporaryPassword,
    });
  }
};

export const createProvisionInstanceAuthArtifacts =
  (createClient: KeycloakProvisioningClientFactory) =>
  async (input: ProvisionInstanceAuthArtifactsInput): Promise<void> => {
    const pluginOidcClientRequirements = readPluginOidcClientRequirements(input);
    const client = createClient(input.authRealm);

    let createdRealm = false;
    if (input.realmMode === 'new') {
      createdRealm = await client.ensureRealm({
        displayName: input.instanceId,
        settings: KEYCLOAK_REALM_BASELINE.realm,
      });
      if (!createdRealm) {
        throw new Error(`Keycloak realm ${input.authRealm} already exists`);
      }
    } else {
      const realm = await client.getRealm();
      if (!realm) {
        throw new Error(`Keycloak realm ${input.authRealm} does not exist`);
      }
    }
    try {
      await reconcileInstanceAuthArtifacts(client, input, pluginOidcClientRequirements);
    } catch (error) {
      if (!createdRealm) {
        throw error;
      }
      try {
        await client.deleteRealm();
      } catch (cleanupError) {
        const cleanupErrorRecord =
          cleanupError !== null && typeof cleanupError === 'object'
            ? (cleanupError as { code?: unknown; statusCode?: unknown })
            : undefined;
        logger.error('realm_cleanup_failed', {
          operation: 'delete_newly_created_realm',
          result: 'failed',
          realm: input.authRealm,
          reconciliation_error_type: error instanceof Error ? error.name : typeof error,
          reconciliation_error_message: error instanceof Error ? error.message : 'unknown',
          error_type: cleanupError instanceof Error ? cleanupError.name : typeof cleanupError,
          error_code: cleanupErrorRecord?.code ?? 'unknown',
          http_status: cleanupErrorRecord?.statusCode,
        });
        const manualActionError = new Error(
          'plugin_oidc_client_reconciliation_failed_realm_cleanup_failed_requires_manual_action'
        ) as Error & { cause?: unknown };
        manualActionError.cause = cleanupError;
        throw manualActionError;
      }
      rethrowAfterSuccessfulRealmCleanup(error);
    }
  };
