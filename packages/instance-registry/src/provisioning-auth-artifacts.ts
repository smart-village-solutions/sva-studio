import { createSdkLogger } from '@sva/server-runtime';
import type { KeycloakProvisioningInput, TenantAdminBootstrap } from './provisioning-auth-types.js';
import type { KeycloakProvisioningClient, KeycloakProvisioningClientFactory } from './provisioning-auth-client.js';
import { ensureTenantAdmin } from './provisioning-auth-tenant-admin.js';
import { buildExpectedClientConfig, buildExpectedTenantAdminClientConfig, SYSTEM_ADMIN_ROLE } from './provisioning-auth-utils.js';
import { readPluginOidcClientAlignment, readPluginOidcClientRequirements } from './provisioning-auth-plugin-clients.js';
import { KEYCLOAK_REALM_BASELINE } from './keycloak-realm-baseline.js';

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
    await client.ensurePersonalMcpAccess(input.authClientId);
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
