import { createSdkLogger } from '@sva/server-runtime';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';
import type { KeycloakProvisioningClientFactory } from './provisioning-auth-client.js';
import { readTenantAdminStatus } from './provisioning-auth-tenant-admin.js';
import { buildExpectedClientConfig, buildExpectedTenantAdminClientConfig, SYSTEM_ADMIN_ROLE } from './provisioning-auth-utils.js';
import { readStudioOwnedClient, readStudioOwnedUser } from './provisioning-auth-policy.js';
import { readPluginOidcClientRequirements } from './provisioning-auth-plugin-clients.js';
import { isKeycloakRealmBaselineAligned, KEYCLOAK_REALM_BASELINE } from './keycloak-realm-baseline.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

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
